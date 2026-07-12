/**
 * InclusionCoordinator – owns all inclusion/exclusion/replace/learn/abort
 * lifecycle, security grant/DSK callbacks, inclusion state, pending nodes,
 * orphan cleanup, tmp metadata, replacement tracking, resolver promises,
 * callback first/last UI client lifecycle, controller/socket events and
 * timing.
 *
 * Extracted from ZwaveClient to keep the monolith slim.
 *
 * Preserves #4639 cleanup (ghost node removal on inclusion failure).
 */

import type {
	InclusionBackupPort,
	InclusionConfigPort,
	InclusionControllerEventPort,
	InclusionDriverPort,
	InclusionGrant,
	InclusionQRPort,
	InclusionServerManagerPort,
	InclusionSocketPort,
	PlannedProvisioningEntry,
	QRProvisioningInformation,
	ServiceLogger,
} from './ports.ts'
import { InclusionStrategy, QRCodeVersion } from './ports.ts'
import type { JoinNetworkResult } from './ports.ts'

export class InclusionCoordinator {
	private readonly _driver: InclusionDriverPort
	private readonly _socket: InclusionSocketPort
	private readonly _controllerEvent: InclusionControllerEventPort
	private readonly _backup: InclusionBackupPort
	private readonly _config: InclusionConfigPort
	private readonly _qr: InclusionQRPort
	private readonly _logger: ServiceLogger

	/** Lazy server manager accessor — may be undefined when server is disabled */
	private readonly _getServerManager: () =>
		| InclusionServerManagerPort
		| undefined

	/** Store node info before inclusion (name and location) */
	private _tmpNode: { name?: string; loc?: string } | undefined = undefined

	/** Whether a node replacement is in progress */
	private _isReplacing = false

	/**
	 * Node IDs surfaced via `node found` that have not yet hit `node added`.
	 * Cleaned up on inclusion failure (see #4639).
	 */
	private _pendingInclusionNodeIds: Set<number> = new Set()

	/** Whether UI user callbacks are currently registered */
	private _hasUserCallbacks = false

	/** Resolve function for security grant promise */
	private _grantResolve: ((grant: InclusionGrant | false) => void) | null =
		null

	/** Resolve function for DSK validation promise */
	private _dskResolve: ((dsk: string | false) => void) | null = null

	/** Current inclusion state mirror */
	private _inclusionState: unknown = undefined

	/** Commands timeout handle */
	private _commandsTimeout: ReturnType<typeof setTimeout> | null = null

	/**
	 * Generation counter — incremented on every reset() so that an
	 * in-flight operation suspended across an await boundary can detect
	 * that a close/restart happened and bail out rather than touching a
	 * stale or freshly-restarted driver.
	 */
	private _generation = 0

	/** NVM event setter callback */
	private _nvmEventSetter: ((event: string) => void) | undefined

	/** Socket event names for the inclusion lifecycle */
	private readonly _socketEvents: {
		grantSecurityClasses: string
		validateDSK: string
		inclusionAborted: string
		controller: string
	}

	constructor(
		driver: InclusionDriverPort,
		socket: InclusionSocketPort,
		controllerEvent: InclusionControllerEventPort,
		backup: InclusionBackupPort,
		config: InclusionConfigPort,
		qr: InclusionQRPort,
		logger: ServiceLogger,
		getServerManager: () => InclusionServerManagerPort | undefined,
		nvmEventSetter: ((event: string) => void) | undefined,
		socketEvents: {
			grantSecurityClasses: string
			validateDSK: string
			inclusionAborted: string
			controller: string
		},
	) {
		this._driver = driver
		this._socket = socket
		this._controllerEvent = controllerEvent
		this._backup = backup
		this._config = config
		this._qr = qr
		this._logger = logger
		this._getServerManager = getServerManager
		this._nvmEventSetter = nvmEventSetter
		this._socketEvents = socketEvents
	}

	get inclusionState(): unknown {
		return this._inclusionState
	}

	get isReplacing(): boolean {
		return this._isReplacing
	}

	get tmpNode(): { name?: string; loc?: string } | undefined {
		return this._tmpNode
	}

	/**
	 * Atomically consume tmpNode metadata: returns the current value and
	 * immediately clears it so that no subsequent caller can inherit stale
	 * metadata from a previous inclusion.
	 */
	takeTmpNode(): { name?: string; loc?: string } | undefined {
		const tmp = this._tmpNode
		this._tmpNode = undefined
		return tmp
	}

	get pendingInclusionNodeIds(): Set<number> {
		return this._pendingInclusionNodeIds
	}

	get hasUserCallbacks(): boolean {
		return this._hasUserCallbacks
	}

	/** Current generation (incremented on reset) — exposed for testing */
	get generation(): number {
		return this._generation
	}

	/**
	 * Returns the user callbacks object to pass to the driver.
	 * Binds to this coordinator instance.
	 */
	getUserCallbacks(): {
		grantSecurityClasses: (
			requested: InclusionGrant,
		) => Promise<InclusionGrant | false>
		validateDSKAndEnterPIN: (dsk: string) => Promise<string | false>
		abort: () => void
	} {
		return {
			grantSecurityClasses: this._onGrantSecurityClasses.bind(this),
			validateDSKAndEnterPIN: this._onValidateDSK.bind(this),
			abort: this._onAbortInclusion.bind(this),
		}
	}

	/**
	 * Start inclusion
	 */
	async startInclusion(
		strategy: InclusionStrategy,
		options?: {
			forceSecurity?: boolean
			provisioning?: PlannedProvisioningEntry
			qrString?: string
			name?: string
			dsk?: string
			location?: string
		},
		provisionSmartStartNode?: (
			parsed: QRProvisioningInformation,
		) => Promise<unknown>,
	): Promise<boolean> {
		const drv = this._driver.getDriver()
		if (!drv || !this._driver.isDriverReady()) {
			throw new Error('Driver is not ready')
		}

		const gen = this._generation

		if (this._backup.backupOnEvent) {
			if (this._nvmEventSetter) {
				this._nvmEventSetter('before_start_inclusion')
			}
			await this._backup.backupNvm()
		}

		// Re-resolve after await — close/restart may have invalidated drv
		if (this._generation !== gen) {
			throw new Error('Driver was closed during inclusion setup')
		}
		const currentDrv = this._driver.getDriver()
		if (!currentDrv || !this._driver.isDriverReady()) {
			throw new Error('Driver is not ready')
		}

		try {
			if (this._commandsTimeout) {
				clearTimeout(this._commandsTimeout)
				this._commandsTimeout = null
			}

			if (options?.name || options?.location) {
				this._tmpNode = {
					name: options.name || '',
					loc: options.location || '',
				}
			} else {
				this._tmpNode = undefined
			}

			this._commandsTimeout = setTimeout(
				() => {
					this.stopInclusion().catch((e) => {
						this._logger.error(
							`Failed to stop inclusion on timeout: ${String(e)}`,
						)
					})
				},
				(this._config.commandsTimeout || 0) * 1000 || 30000,
			)

			if (
				strategy === InclusionStrategy.Insecure ||
				strategy === InclusionStrategy.Security_S0
			) {
				this._isReplacing = false
				return currentDrv.controller.beginInclusion({ strategy })
			}

			if (strategy === InclusionStrategy.SmartStart) {
				throw Error(
					'In order to use Smart Start add you node to provisioning list',
				)
			}

			if (strategy === InclusionStrategy.Default) {
				this._isReplacing = false
				return currentDrv.controller.beginInclusion({
					strategy,
					forceSecurity: options?.forceSecurity,
				})
			}

			if (strategy === InclusionStrategy.Security_S2) {
				if (options?.qrString) {
					const parsedQr = await this._qr.parseQRCodeString(
						options.qrString,
					)

					// Re-resolve after QR parse — close/restart may have invalidated drv
					if (this._generation !== gen) {
						throw new Error(
							'Driver was closed during inclusion setup',
						)
					}

					if (!parsedQr) {
						throw Error(`Invalid QR code string`)
					}

					if (parsedQr.version === QRCodeVersion.S2) {
						options.provisioning = parsedQr
					} else if (parsedQr.version === QRCodeVersion.SmartStart) {
						if (provisionSmartStartNode) {
							await provisionSmartStartNode(parsedQr)
						}
						return true
					} else {
						throw Error(`Invalid QR code version`)
					}
				}
				if (options?.provisioning) {
					this._isReplacing = false
					return currentDrv.controller.beginInclusion({
						strategy,
						provisioning: options.provisioning,
					})
				}
				this._isReplacing = false
				return currentDrv.controller.beginInclusion({
					strategy,
					dsk: options?.dsk,
				})
			}

			this._isReplacing = false
			return currentDrv.controller.beginInclusion()
		} catch (error) {
			this._tmpNode = undefined
			throw error
		}
	}

	/**
	 * Start exclusion
	 */
	async startExclusion(options: unknown): Promise<boolean> {
		const drv = this._driver.getDriver()
		if (!drv || !this._driver.isDriverReady()) {
			throw new Error('Driver is not ready')
		}

		const gen = this._generation

		if (this._backup.backupOnEvent) {
			if (this._nvmEventSetter) {
				this._nvmEventSetter('before_start_exclusion')
			}
			await this._backup.backupNvm()
		}

		// Re-resolve after await — close/restart may have invalidated drv
		if (this._generation !== gen) {
			throw new Error('Driver was closed during exclusion setup')
		}
		const currentDrv = this._driver.getDriver()
		if (!currentDrv || !this._driver.isDriverReady()) {
			throw new Error('Driver is not ready')
		}

		if (this._commandsTimeout) {
			clearTimeout(this._commandsTimeout)
			this._commandsTimeout = null
		}

		this._commandsTimeout = setTimeout(
			() => {
				this.stopExclusion().catch((e) => {
					this._logger.error(
						`Failed to stop exclusion on timeout: ${String(e)}`,
					)
				})
			},
			(this._config.commandsTimeout || 0) * 1000 || 30000,
		)

		return currentDrv.controller.beginExclusion(options)
	}

	/**
	 * Stop exclusion
	 */
	async stopExclusion(): Promise<boolean> {
		const drv = this._driver.getDriver()
		if (!drv || !this._driver.isDriverReady()) {
			throw new Error('Driver is not ready')
		}

		if (this._commandsTimeout) {
			clearTimeout(this._commandsTimeout)
			this._commandsTimeout = null
		}
		return drv.controller.stopExclusion()
	}

	/**
	 * Stop inclusion
	 */
	async stopInclusion(): Promise<boolean> {
		const drv = this._driver.getDriver()
		if (!drv || !this._driver.isDriverReady()) {
			throw new Error('Driver is not ready')
		}

		if (this._commandsTimeout) {
			clearTimeout(this._commandsTimeout)
			this._commandsTimeout = null
		}
		return drv.controller.stopInclusion()
	}

	/**
	 * Replace failed node
	 */
	async replaceFailedNode(
		nodeId: number,
		strategy: InclusionStrategy,
		options?: {
			qrString?: string
			provisioning?: PlannedProvisioningEntry
		},
	): Promise<boolean> {
		try {
			const drv = this._driver.getDriver()
			if (!drv || !this._driver.isDriverReady()) {
				throw new Error('Driver is not ready')
			}

			const gen = this._generation

			if (this._backup.backupOnEvent) {
				if (this._nvmEventSetter) {
					this._nvmEventSetter('before_replace_failed_node')
				}
				await this._backup.backupNvm()
			}

			// Re-resolve after await — close/restart may have invalidated drv
			if (this._generation !== gen) {
				throw new Error('Driver was closed during replace setup')
			}
			const currentDrv = this._driver.getDriver()
			if (!currentDrv || !this._driver.isDriverReady()) {
				throw new Error('Driver is not ready')
			}

			if (this._commandsTimeout) {
				clearTimeout(this._commandsTimeout)
				this._commandsTimeout = null
			}

			this._commandsTimeout = setTimeout(
				() => {
					this.stopInclusion().catch((e) => {
						this._logger.error(
							`Failed to stop inclusion on timeout: ${String(e)}`,
						)
					})
				},
				(this._config.commandsTimeout || 0) * 1000 || 30000,
			)

			this._isReplacing = true

			if (strategy === InclusionStrategy.Security_S2) {
				if (options?.qrString) {
					const parsedQr = await this._qr.parseQRCodeString(
						options.qrString,
					)

					// Re-resolve after QR parse — close/restart may have invalidated drv
					if (this._generation !== gen) {
						throw new Error(
							'Driver was closed during replace setup',
						)
					}

					if (parsedQr) {
						options.provisioning = parsedQr
					} else {
						throw Error(`Invalid QR code string`)
					}
				}
				if (options?.provisioning) {
					return await currentDrv.controller.replaceFailedNode(
						nodeId,
						{
							strategy,
							provisioning: options.provisioning,
						},
					)
				}
				return await currentDrv.controller.replaceFailedNode(nodeId, {
					strategy,
				})
			}

			if (
				strategy === InclusionStrategy.Insecure ||
				strategy === InclusionStrategy.Security_S0
			) {
				return await currentDrv.controller.replaceFailedNode(nodeId, {
					strategy,
				})
			}

			throw Error(
				`Inclusion strategy not supported with replace failed node api`,
			)
		} catch (error) {
			this._isReplacing = false
			throw error
		}
	}

	/**
	 * Start learn mode (join another network)
	 */
	async startLearnMode(
		joinNetworkStrategy: number,
	): Promise<JoinNetworkResult> {
		const drv = this._driver.getDriver()
		if (!drv || !this._driver.isDriverReady()) {
			throw new Error('Driver is not ready')
		}

		if (this._commandsTimeout) {
			clearTimeout(this._commandsTimeout)
			this._commandsTimeout = null
		}

		this._commandsTimeout = setTimeout(
			() => {
				this.stopLearnMode().catch((e) => {
					this._logger.error(
						`Failed to stop learn mode on timeout: ${String(e)}`,
					)
				})
			},
			(this._config.commandsTimeout || 0) * 1000 || 30000,
		)

		const joinNetworkOptions = {
			strategy: joinNetworkStrategy,
		}

		return drv.controller.beginJoiningNetwork(joinNetworkOptions)
	}

	/**
	 * Stop learn mode
	 */
	async stopLearnMode(): Promise<boolean> {
		const drv = this._driver.getDriver()
		if (!drv || !this._driver.isDriverReady()) {
			throw new Error('Driver is not ready')
		}

		if (this._commandsTimeout) {
			clearTimeout(this._commandsTimeout)
			this._commandsTimeout = null
		}
		return drv.controller.stopJoiningNetwork()
	}

	/**
	 * Grant security classes (called by UI after user approves)
	 */
	grantSecurityClasses(requested: InclusionGrant): void {
		if (this._grantResolve) {
			this._grantResolve(requested)
			this._grantResolve = null
		} else {
			this._logger.error('No inclusion process started')
		}
	}

	/**
	 * Validate DSK (called by UI after user enters PIN)
	 */
	validateDSK(dsk: string): void {
		if (this._dskResolve) {
			this._dskResolve(dsk)
			this._dskResolve = null
		} else {
			this._logger.error('No inclusion process started')
		}
	}

	/**
	 * Abort inclusion (called by UI or timeout)
	 */
	abortInclusion(): void {
		this._settlePendingPromises()
	}

	/**
	 * Register user callbacks with the driver (first UI client connected)
	 */
	setUserCallbacks(): void {
		this._hasUserCallbacks = true
		const drv = this._driver.getDriver()
		if (!drv || !this._config.serverEnabled) {
			return
		}

		this._logger.info('Setting user callbacks')

		drv.updateOptions({
			inclusionUserCallbacks: {
				...this.getUserCallbacks(),
			},
		})
	}

	/**
	 * Remove user callbacks from the driver (last UI client disconnected)
	 */
	removeUserCallbacks(): void {
		this._hasUserCallbacks = false
		const drv = this._driver.getDriver()
		if (!drv || !this._config.serverEnabled) {
			return
		}

		this._logger.info('Removing user callbacks')

		drv.updateOptions({
			inclusionUserCallbacks: undefined,
		})

		// when no user is connected, give back the control to HA server
		const mgr = this._getServerManager()
		if (mgr) {
			mgr.handInclusionControlBack()
		}
	}

	/**
	 * Re-register user callbacks on the current driver after a driver
	 * replacement (hard reset or restart). The coordinator survives but
	 * the new driver needs the callbacks passed via updateOptions again.
	 */
	reinstallUserCallbacks(): void {
		if (!this._hasUserCallbacks) {
			return
		}
		const drv = this._driver.getDriver()
		if (!drv || !this._config.serverEnabled) {
			return
		}
		this._logger.info('Re-registering user callbacks on new driver')
		drv.updateOptions({
			inclusionUserCallbacks: {
				...this.getUserCallbacks(),
			},
		})
	}

	/**
	 * Handle inclusion state changed event from controller
	 */
	onInclusionStateChanged(
		state: unknown,
		cntStatus: string,
		error: string | undefined,
	): void {
		if (state !== this._inclusionState) {
			this._inclusionState = state

			this._socket.sendToSocket(this._socketEvents.controller, {
				status: cntStatus,
				error: error,
				inclusionState: this._inclusionState,
			})
		}
	}

	/**
	 * Handle inclusion failed event
	 */
	onInclusionFailed(removeNode: (nodeId: number) => void): void {
		this._isReplacing = false
		this._tmpNode = undefined

		// Clear ghost nodes (#4639)
		for (const nodeId of this._pendingInclusionNodeIds) {
			removeNode(nodeId)
		}
		this._pendingInclusionNodeIds.clear()
	}

	/**
	 * Track a node found during inclusion
	 */
	onNodeFound(nodeId: number): void {
		this._pendingInclusionNodeIds.add(nodeId)
	}

	/**
	 * Clear a node from pending after it was successfully added
	 */
	onNodeAdded(nodeId: number): void {
		this._pendingInclusionNodeIds.delete(nodeId)
	}

	/**
	 * Sync inclusion state from driver (called after driver ready)
	 */
	syncFromDriver(): void {
		const drv = this._driver.getDriver()
		if (drv) {
			this._inclusionState = drv.controller.inclusionState
		}
	}

	/**
	 * Clear commands timeout (called during close)
	 */
	clearCommandsTimeout(): void {
		if (this._commandsTimeout) {
			clearTimeout(this._commandsTimeout)
			this._commandsTimeout = null
		}
	}

	/**
	 * Reset all state (called during close/restart).
	 * Settles every pending grant/DSK promise with `false` exactly once
	 * before clearing references so callers are never left dangling.
	 */
	reset(): void {
		this._generation++
		this.clearCommandsTimeout()
		this._tmpNode = undefined
		this._isReplacing = false
		this._pendingInclusionNodeIds.clear()
		this._settlePendingPromises()
	}

	/**
	 * Settle pending grant and DSK promises with `false`, exactly once.
	 * Idempotent: subsequent calls are no-ops because references are
	 * nulled after invocation.
	 */
	private _settlePendingPromises(): void {
		if (this._dskResolve) {
			this._dskResolve(false)
			this._dskResolve = null
		}
		if (this._grantResolve) {
			this._grantResolve(false)
			this._grantResolve = null
		}
	}

	private _onGrantSecurityClasses(
		requested: InclusionGrant,
	): Promise<InclusionGrant | false> {
		this._logger.info(
			`Grant security classes: ${JSON.stringify(requested)}`,
		)
		this._socket.sendToSocket(
			this._socketEvents.grantSecurityClasses,
			requested,
		)

		this._controllerEvent.emitControllerEvent(
			'grant security classes',
			requested,
		)

		return new Promise((resolve) => {
			this._grantResolve = resolve
		})
	}

	private _onValidateDSK(dsk: string): Promise<string | false> {
		this._logger.info(`DSK received ${dsk}`)

		this._socket.sendToSocket(this._socketEvents.validateDSK, dsk)

		this._controllerEvent.emitControllerEvent('validate dsk', dsk)

		return new Promise((resolve) => {
			this._dskResolve = resolve
		})
	}

	private _onAbortInclusion(): void {
		// Settle any pending promises exactly once (idempotent)
		this._settlePendingPromises()
		this._socket.sendToSocket(this._socketEvents.inclusionAborted, true)

		this._controllerEvent.emitControllerEvent('inclusion aborted')

		this._logger.warn('Inclusion aborted')
	}
}
