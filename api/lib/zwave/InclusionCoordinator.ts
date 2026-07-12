/**
 * InclusionCoordinator – owns all inclusion/exclusion/replace/learn/abort
 * lifecycle, security grant/DSK callbacks, inclusion state, pending nodes,
 * orphan cleanup, tmp metadata, replacement tracking, resolver promises,
 * callback first/last UI client lifecycle, controller/socket events and
 * timing.
 *
 * Extracted from ZwaveClient to keep the monolith slim. The service is
 * strict-clean (no `any` casts, no non-null assertions, no ts-ignore).
 *
 * Preserves #4639 cleanup (ghost node removal on inclusion failure) and all
 * existing edge-case / malformed behavior paths.
 *
 * Ports:
 *   driver        – driver + controller access
 *   socket        – socket emission
 *   backup        – NVM backup before inclusion/exclusion/replace
 *   config        – runtime config (commandsTimeout, serverEnabled)
 *   qr            – QR code parsing
 *   serverManager – HA server manager for handing control back
 *   logger        – structured logging
 */

import type {
	InclusionBackupPort,
	InclusionConfigPort,
	InclusionDriverPort,
	InclusionGrantRef,
	InclusionQRPort,
	InclusionServerManagerPort,
	InclusionSocketPort,
	ServiceLogger,
} from './ports.ts'

/** QR code version constants matching zwave-js */
const QR_VERSION_S2 = 0
const QR_VERSION_SMART_START = 1

export class InclusionCoordinator {
	private readonly _driver: InclusionDriverPort
	private readonly _socket: InclusionSocketPort
	private readonly _backup: InclusionBackupPort
	private readonly _config: InclusionConfigPort
	private readonly _qr: InclusionQRPort
	private readonly _logger: ServiceLogger

	/** Lazy server manager accessor — may be undefined when server is disabled */
	private readonly _getServerManager: () =>
		| InclusionServerManagerPort
		| undefined

	// ---------------------------------------------------------------
	// Internal state — maps exactly to ZwaveClient fields
	// ---------------------------------------------------------------

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
	private _grantResolve: ((grant: InclusionGrantRef | false) => void) | null =
		null

	/** Resolve function for DSK validation promise */
	private _dskResolve: ((dsk: string | false) => void) | null = null

	/** Current inclusion state mirror */
	private _inclusionState: unknown = undefined

	/** Commands timeout handle */
	private _commandsTimeout: ReturnType<typeof setTimeout> | null = null

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
		this._backup = backup
		this._config = config
		this._qr = qr
		this._logger = logger
		this._getServerManager = getServerManager
		this._nvmEventSetter = nvmEventSetter
		this._socketEvents = socketEvents
	}

	// ---------------------------------------------------------------
	// State accessors
	// ---------------------------------------------------------------

	get inclusionState(): unknown {
		return this._inclusionState
	}

	get isReplacing(): boolean {
		return this._isReplacing
	}

	get tmpNode(): { name?: string; loc?: string } | undefined {
		return this._tmpNode
	}

	get pendingInclusionNodeIds(): Set<number> {
		return this._pendingInclusionNodeIds
	}

	get hasUserCallbacks(): boolean {
		return this._hasUserCallbacks
	}

	// ---------------------------------------------------------------
	// Inclusion user callbacks (passed to zwave-js driver)
	// ---------------------------------------------------------------

	/**
	 * Returns the user callbacks object to pass to the driver.
	 * Binds to this coordinator instance.
	 */
	getUserCallbacks(): {
		grantSecurityClasses: (
			requested: InclusionGrantRef,
		) => Promise<InclusionGrantRef | false>
		validateDSKAndEnterPIN: (dsk: string) => Promise<string | false>
		abort: () => void
	} {
		return {
			grantSecurityClasses: this._onGrantSecurityClasses.bind(this),
			validateDSKAndEnterPIN: this._onValidateDSK.bind(this),
			abort: this._onAbortInclusion.bind(this),
		}
	}

	// ---------------------------------------------------------------
	// Public API — exact signatures preserved from ZwaveClient
	// ---------------------------------------------------------------

	/**
	 * Start inclusion
	 */
	async startInclusion(
		strategy: number,
		options?: {
			forceSecurity?: boolean
			provisioning?: unknown
			qrString?: string
			name?: string
			dsk?: string
			location?: string
		},
		provisionSmartStartNode?: (parsed: unknown) => Promise<unknown>,
		inclusionStrategySmartStart?: number,
		inclusionStrategySecurity_S2?: number,
		inclusionStrategyDefault?: number,
		inclusionStrategyInsecure?: number,
		inclusionStrategySecurity_S0?: number,
		qrCodeVersionSmartStart?: number,
		qrCodeVersionS2?: number,
	): Promise<boolean> {
		const drv = this._driver.getDriver()
		if (!drv || !this._driver.isDriverReady()) {
			throw new Error('Driver is not ready')
		}

		if (this._backup.backupOnEvent) {
			if (this._nvmEventSetter) {
				this._nvmEventSetter('before_start_inclusion')
			}
			await this._backup.backupNvm()
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

			let inclusionOptions: unknown

			if (
				strategy === inclusionStrategyInsecure ||
				strategy === inclusionStrategySecurity_S0
			) {
				inclusionOptions = { strategy }
			} else if (strategy === inclusionStrategySmartStart) {
				throw Error(
					'In order to use Smart Start add you node to provisioning list',
				)
			} else if (strategy === inclusionStrategyDefault) {
				inclusionOptions = {
					strategy,
					forceSecurity: options?.forceSecurity,
				}
			} else if (strategy === inclusionStrategySecurity_S2) {
				if (options?.qrString) {
					const parsedQr = await this._qr.parseQRCodeString(
						options.qrString,
					)
					if (!parsedQr) {
						throw Error(`Invalid QR code string`)
					}

					if (parsedQr.version === qrCodeVersionS2) {
						options.provisioning = parsedQr
					} else if (parsedQr.version === qrCodeVersionSmartStart) {
						if (provisionSmartStartNode) {
							await provisionSmartStartNode(parsedQr)
						}
						return true
					} else {
						throw Error(`Invalid QR code version`)
					}
				}
				if (options?.provisioning) {
					inclusionOptions = {
						strategy,
						dsk: options.dsk,
						provisioning: options.provisioning,
					}
				} else {
					inclusionOptions = { strategy, dsk: options?.dsk }
				}
			} else {
				inclusionOptions = { strategy }
			}

			this._isReplacing = false

			return drv.controller.beginInclusion(inclusionOptions)
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

		if (this._backup.backupOnEvent) {
			if (this._nvmEventSetter) {
				this._nvmEventSetter('before_start_exclusion')
			}
			await this._backup.backupNvm()
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

		return drv.controller.beginExclusion(options)
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
		strategy: number,
		options?: {
			qrString?: string
			provisioning?: unknown
		},
		inclusionStrategySecurity_S2?: number,
		inclusionStrategyInsecure?: number,
		inclusionStrategySecurity_S0?: number,
	): Promise<boolean> {
		try {
			const drv = this._driver.getDriver()
			if (!drv || !this._driver.isDriverReady()) {
				throw new Error('Driver is not ready')
			}

			if (this._backup.backupOnEvent) {
				if (this._nvmEventSetter) {
					this._nvmEventSetter('before_replace_failed_node')
				}
				await this._backup.backupNvm()
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

			if (strategy === inclusionStrategySecurity_S2) {
				let inclusionOptions: unknown
				if (options?.qrString) {
					const parsedQr = await this._qr.parseQRCodeString(
						options.qrString,
					)

					if (parsedQr) {
						options.provisioning = parsedQr
					} else {
						throw Error(`Invalid QR code string`)
					}
				}
				if (options?.provisioning) {
					inclusionOptions = {
						strategy,
						provisioning: options.provisioning,
					}
				} else {
					inclusionOptions = {
						strategy,
					}
				}
				return await drv.controller.replaceFailedNode(
					nodeId,
					inclusionOptions,
				)
			} else if (
				strategy === inclusionStrategyInsecure ||
				strategy === inclusionStrategySecurity_S0
			) {
				return await drv.controller.replaceFailedNode(nodeId, {
					strategy,
				})
			} else {
				throw Error(
					`Inclusion strategy not supported with replace failed node api`,
				)
			}
		} catch (error) {
			this._isReplacing = false
			throw error
		}
	}

	/**
	 * Start learn mode (join another network)
	 */
	async startLearnMode(joinNetworkStrategy: number): Promise<unknown> {
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

	// ---------------------------------------------------------------
	// Security grant / DSK resolution (UI interaction)
	// ---------------------------------------------------------------

	/**
	 * Grant security classes (called by UI after user approves)
	 */
	grantSecurityClasses(requested: InclusionGrantRef): void {
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
		if (this._dskResolve) {
			this._dskResolve(false)
			this._dskResolve = null
		}

		if (this._grantResolve) {
			this._grantResolve(false)
			this._grantResolve = null
		}
	}

	// ---------------------------------------------------------------
	// User callbacks lifecycle (first/last UI client)
	// ---------------------------------------------------------------

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

	// ---------------------------------------------------------------
	// Controller event handlers
	// ---------------------------------------------------------------

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

	// ---------------------------------------------------------------
	// Cleanup
	// ---------------------------------------------------------------

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
	 * Reset all state (called during close/restart)
	 */
	reset(): void {
		this.clearCommandsTimeout()
		this._tmpNode = undefined
		this._isReplacing = false
		this._pendingInclusionNodeIds.clear()
		this._grantResolve = null
		this._dskResolve = null
	}

	// ---------------------------------------------------------------
	// Private callback implementations
	// ---------------------------------------------------------------

	private _onGrantSecurityClasses(
		requested: InclusionGrantRef,
	): Promise<InclusionGrantRef | false> {
		this._logger.info(
			`Grant security classes: ${JSON.stringify(requested)}`,
		)
		this._socket.sendToSocket(
			this._socketEvents.grantSecurityClasses,
			requested,
		)

		return new Promise((resolve) => {
			this._grantResolve = resolve
		})
	}

	private _onValidateDSK(dsk: string): Promise<string | false> {
		this._logger.info(`DSK received ${dsk}`)

		this._socket.sendToSocket(this._socketEvents.validateDSK, dsk)

		return new Promise((resolve) => {
			this._dskResolve = resolve
		})
	}

	private _onAbortInclusion(): void {
		this._dskResolve = null
		this._grantResolve = null
		this._socket.sendToSocket(this._socketEvents.inclusionAborted, true)

		this._logger.warn('Inclusion aborted')
	}
}
