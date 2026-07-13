import type {
	InclusionBackupPort,
	InclusionConfigPort,
	InclusionControllerEventPort,
	InclusionDriverPort,
	InclusionGrant,
	InclusionQRPort,
	InclusionServerManagerPort,
	InclusionSocketPort,
	InclusionState,
	PlannedProvisioningEntry,
	QRProvisioningInformation,
	ServiceLogger,
} from '#api/lib/zwave/ports'
import { InclusionStrategy, QRCodeVersion } from '#api/lib/zwave/ports'
import type { JoinNetworkResult } from '#api/lib/zwave/ports'

export class InclusionLifecycleCancelledError extends Error {
	constructor(operation: string) {
		super(`Driver was closed during ${operation} setup`)
		this.name = 'InclusionLifecycleCancelledError'
	}
}

export class InclusionCoordinator {
	private readonly _driver: InclusionDriverPort
	private readonly _socket: InclusionSocketPort
	private readonly _controllerEvent: InclusionControllerEventPort
	private readonly _backup: InclusionBackupPort
	private readonly _config: InclusionConfigPort
	private readonly _qr: InclusionQRPort
	private readonly _logger: ServiceLogger

	/** May be undefined when server is disabled */
	private readonly _getServerManager: () =>
		| InclusionServerManagerPort
		| undefined

	private _tmpNode: { name?: string; loc?: string } | undefined = undefined

	private _isReplacing = false

	private _pendingInclusionNodeIds: Set<number> = new Set()

	private _hasUserCallbacks = false

	private _grantResolve: ((grant: InclusionGrant | false) => void) | null =
		null

	private _dskResolve: ((dsk: string | false) => void) | null = null

	private _inclusionState: InclusionState | undefined = undefined

	private _commandsTimeout: ReturnType<typeof setTimeout> | null = null

	// Advance on reset so setup suspended by backup or QR parsing cannot use a replacement driver
	private _generation = 0

	private _setupToken = 0

	private _commandToken = 0

	private _nvmEventSetter: ((event: string) => void) | undefined

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

	get inclusionState(): InclusionState | undefined {
		return this._inclusionState
	}

	get isReplacing(): boolean {
		return this._isReplacing
	}

	get tmpNode(): { name?: string; loc?: string } | undefined {
		return this._tmpNode
	}

	takeTmpNode(): { name?: string; loc?: string } | undefined {
		// Consume metadata once so later inclusions cannot inherit it
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

	getUserCallbacks(): {
		grantSecurityClasses: (
			requested: InclusionGrant,
		) => Promise<InclusionGrant | false>
		validateDSKAndEnterPIN: (dsk: string) => Promise<string | false>
		abort: () => void
	} {
		const gen = this._generation
		return {
			grantSecurityClasses: (requested) => {
				if (this._generation !== gen) {
					return Promise.resolve(false)
				}
				return this._onGrantSecurityClasses(requested)
			},
			validateDSKAndEnterPIN: (dsk) => {
				if (this._generation !== gen) {
					return Promise.resolve(false)
				}
				return this._onValidateDSK(dsk)
			},
			abort: () => {
				if (this._generation === gen) {
					this._onAbortInclusion()
				}
			},
		}
	}

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
		const setupToken = ++this._setupToken

		if (this._backup.backupOnEvent) {
			if (this._nvmEventSetter) {
				this._nvmEventSetter('before_start_inclusion')
			}
			await this._backup.backupNvm()
		}

		// Re-resolve because close or restart may replace the driver during await
		this._assertSetup(gen, setupToken, 'inclusion')
		const commandToken = ++this._commandToken
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
					if (this._commandToken !== commandToken) {
						return
					}
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
				return await this._beginInclusion(
					currentDrv.controller,
					{ strategy },
					gen,
					commandToken,
				)
			}

			if (strategy === InclusionStrategy.SmartStart) {
				throw Error(
					'In order to use Smart Start add you node to provisioning list',
				)
			}

			if (strategy === InclusionStrategy.Default) {
				this._isReplacing = false
				return await this._beginInclusion(
					currentDrv.controller,
					{
						strategy,
						forceSecurity: options?.forceSecurity,
					},
					gen,
					commandToken,
				)
			}

			if (strategy === InclusionStrategy.Security_S2) {
				if (options?.qrString) {
					const parsedQr = await this._qr.parseQRCodeString(
						options.qrString,
					)

					// Re-resolve because QR parsing may overlap driver replacement
					this._assertCommand(gen, commandToken, 'inclusion')

					if (!parsedQr) {
						throw Error(`Invalid QR code string`)
					}

					if (parsedQr.version === QRCodeVersion.S2) {
						options.provisioning = parsedQr
					} else if (parsedQr.version === QRCodeVersion.SmartStart) {
						if (provisionSmartStartNode) {
							await provisionSmartStartNode(parsedQr)
						}
						this._assertCommand(gen, commandToken, 'inclusion')
						this._commandToken++
						this.clearCommandsTimeout()
						this._tmpNode = undefined
						this._isReplacing = false
						return true
					} else {
						throw Error(`Invalid QR code version`)
					}
				}
				if (options?.provisioning) {
					this._isReplacing = false
					return await this._beginInclusion(
						currentDrv.controller,
						{
							strategy,
							provisioning: options.provisioning,
						},
						gen,
						commandToken,
					)
				}
				this._isReplacing = false
				return await this._beginInclusion(
					currentDrv.controller,
					{
						strategy,
						dsk: options?.dsk,
					},
					gen,
					commandToken,
				)
			}

			this._isReplacing = false
			return await this._beginInclusion(
				currentDrv.controller,
				undefined,
				gen,
				commandToken,
			)
		} catch (error) {
			if (this._ownsCommand(gen, commandToken)) {
				this._tmpNode = undefined
				this.clearCommandsTimeout()
			}
			throw error
		}
	}

	async startExclusion(options: unknown): Promise<boolean> {
		const drv = this._driver.getDriver()
		if (!drv || !this._driver.isDriverReady()) {
			throw new Error('Driver is not ready')
		}

		const gen = this._generation
		const setupToken = ++this._setupToken

		if (this._backup.backupOnEvent) {
			if (this._nvmEventSetter) {
				this._nvmEventSetter('before_start_exclusion')
			}
			await this._backup.backupNvm()
		}

		// Re-resolve because close or restart may replace the driver during await
		this._assertSetup(gen, setupToken, 'exclusion')
		const commandToken = ++this._commandToken
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
				if (this._commandToken !== commandToken) {
					return
				}
				this.stopExclusion().catch((e) => {
					this._logger.error(
						`Failed to stop exclusion on timeout: ${String(e)}`,
					)
				})
			},
			(this._config.commandsTimeout || 0) * 1000 || 30000,
		)

		try {
			const result = await currentDrv.controller.beginExclusion(options)
			this._assertCommand(gen, commandToken, 'exclusion')
			return result
		} catch (error) {
			if (this._ownsCommand(gen, commandToken)) {
				this.clearCommandsTimeout()
			}
			throw error
		}
	}

	async stopExclusion(): Promise<boolean> {
		const drv = this._driver.getDriver()
		if (!drv || !this._driver.isDriverReady()) {
			throw new Error('Driver is not ready')
		}

		this._setupToken++
		this._commandToken++
		if (this._commandsTimeout) {
			clearTimeout(this._commandsTimeout)
			this._commandsTimeout = null
		}
		return drv.controller.stopExclusion()
	}

	async stopInclusion(): Promise<boolean> {
		const drv = this._driver.getDriver()
		if (!drv || !this._driver.isDriverReady()) {
			throw new Error('Driver is not ready')
		}

		this._setupToken++
		this._commandToken++
		if (this._commandsTimeout) {
			clearTimeout(this._commandsTimeout)
			this._commandsTimeout = null
		}
		return drv.controller.stopInclusion()
	}

	async replaceFailedNode(
		nodeId: number,
		strategy: InclusionStrategy,
		options?: {
			qrString?: string
			provisioning?: PlannedProvisioningEntry
		},
	): Promise<boolean> {
		const gen = this._generation
		const setupToken = ++this._setupToken
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

		// Re-resolve because close or restart may replace the driver during await
		this._assertSetup(gen, setupToken, 'replace')
		const commandToken = ++this._commandToken
		try {
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
					if (this._commandToken !== commandToken) {
						return
					}
					this.stopInclusion().catch((e) => {
						this._logger.error(
							`Failed to stop inclusion on timeout: ${String(e)}`,
						)
					})
				},
				(this._config.commandsTimeout || 0) * 1000 || 30000,
			)

			this._isReplacing = true

			let result: boolean
			if (strategy === InclusionStrategy.Security_S2) {
				if (options?.qrString) {
					const parsedQr = await this._qr.parseQRCodeString(
						options.qrString,
					)

					// Re-resolve because QR parsing may overlap driver replacement
					this._assertCommand(gen, commandToken, 'replace')

					if (parsedQr) {
						options.provisioning = parsedQr
					} else {
						throw Error(`Invalid QR code string`)
					}
				}
				if (options?.provisioning) {
					result = await currentDrv.controller.replaceFailedNode(
						nodeId,
						{
							strategy,
							provisioning: options.provisioning,
						},
					)
				} else {
					result = await currentDrv.controller.replaceFailedNode(
						nodeId,
						{
							strategy,
						},
					)
				}
			} else if (
				strategy === InclusionStrategy.Insecure ||
				strategy === InclusionStrategy.Security_S0
			) {
				result = await currentDrv.controller.replaceFailedNode(nodeId, {
					strategy,
				})
			} else {
				throw Error(
					`Inclusion strategy not supported with replace failed node api`,
				)
			}

			this._assertCommand(gen, commandToken, 'replace')
			return result
		} catch (error) {
			if (this._ownsCommand(gen, commandToken)) {
				this._isReplacing = false
				this.clearCommandsTimeout()
			}
			throw error
		}
	}

	async startLearnMode(
		joinNetworkStrategy: number,
	): Promise<JoinNetworkResult> {
		const drv = this._driver.getDriver()
		if (!drv || !this._driver.isDriverReady()) {
			throw new Error('Driver is not ready')
		}

		const gen = this._generation
		this._setupToken++
		const commandToken = ++this._commandToken

		if (this._commandsTimeout) {
			clearTimeout(this._commandsTimeout)
			this._commandsTimeout = null
		}

		this._commandsTimeout = setTimeout(
			() => {
				if (this._commandToken !== commandToken) {
					return
				}
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

		try {
			const result =
				await drv.controller.beginJoiningNetwork(joinNetworkOptions)
			this._assertCommand(gen, commandToken, 'learn mode')
			return result
		} catch (error) {
			if (this._ownsCommand(gen, commandToken)) {
				this.clearCommandsTimeout()
			}
			throw error
		}
	}

	async stopLearnMode(): Promise<boolean> {
		const drv = this._driver.getDriver()
		if (!drv || !this._driver.isDriverReady()) {
			throw new Error('Driver is not ready')
		}

		this._setupToken++
		this._commandToken++
		if (this._commandsTimeout) {
			clearTimeout(this._commandsTimeout)
			this._commandsTimeout = null
		}
		return drv.controller.stopJoiningNetwork()
	}

	grantSecurityClasses(requested: InclusionGrant): void {
		if (this._grantResolve) {
			this._grantResolve(requested)
			this._grantResolve = null
		} else {
			this._logger.error('No inclusion process started')
		}
	}

	validateDSK(dsk: string): void {
		if (this._dskResolve) {
			this._dskResolve(dsk)
			this._dskResolve = null
		} else {
			this._logger.error('No inclusion process started')
		}
	}

	abortInclusion(): void {
		this._settlePendingPromises()
	}

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

		// Hand control back to HA server when no UI is connected
		const mgr = this._getServerManager()
		if (mgr) {
			mgr.handInclusionControlBack()
		}
	}

	reinstallUserCallbacks(): void {
		const drv = this._driver.getDriver()
		if (!drv || (this._config.serverEnabled && !this._hasUserCallbacks)) {
			return
		}
		this._logger.info('Re-registering user callbacks on new driver')
		drv.updateOptions({
			inclusionUserCallbacks: {
				...this.getUserCallbacks(),
			},
		})
	}

	onInclusionStateChanged(
		state: InclusionState,
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

	/** Safe to clear here because zwave-js guarantees 'node removed' fires before 'inclusion stopped' */
	onInclusionStopped(): void {
		this._isReplacing = false
	}

	onInclusionFailed(removeNode: (nodeId: number) => void): void {
		this._isReplacing = false
		this._tmpNode = undefined

		// Clear ghost nodes (#4639)
		for (const nodeId of this._pendingInclusionNodeIds) {
			removeNode(nodeId)
		}
		this._pendingInclusionNodeIds.clear()
	}

	onNodeFound(nodeId: number): void {
		this._pendingInclusionNodeIds.add(nodeId)
	}

	onNodeAdded(nodeId: number): void {
		// Retain replacement state because old-node cleanup also reaches this path
		this._pendingInclusionNodeIds.delete(nodeId)
	}

	onReplacementComplete(): void {
		// Clear replacement only after the real node-added event preserves old-node metadata
		this._isReplacing = false
	}

	syncFromDriver(): void {
		const drv = this._driver.getDriver()
		if (drv) {
			this._inclusionState = drv.controller.inclusionState
		}
	}

	clearCommandsTimeout(): void {
		if (this._commandsTimeout) {
			clearTimeout(this._commandsTimeout)
			this._commandsTimeout = null
		}
	}

	reset(): void {
		this._generation++
		this._setupToken++
		this._commandToken++
		this.clearCommandsTimeout()
		this._tmpNode = undefined
		this._isReplacing = false
		this._inclusionState = undefined
		this._pendingInclusionNodeIds.clear()
		// Reject pending UI decisions because reset invalidates their inclusion flow
		this._settlePendingPromises()
	}

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

	private async _beginInclusion(
		controller: NonNullable<
			ReturnType<InclusionDriverPort['getDriver']>
		>['controller'],
		options: Parameters<
			NonNullable<
				ReturnType<InclusionDriverPort['getDriver']>
			>['controller']['beginInclusion']
		>[0],
		gen: number,
		commandToken: number,
	): Promise<boolean> {
		const result = await controller.beginInclusion(options)
		this._assertCommand(gen, commandToken, 'inclusion')
		return result
	}

	private _ownsCommand(gen: number, commandToken: number): boolean {
		return this._generation === gen && this._commandToken === commandToken
	}

	private _assertSetup(
		gen: number,
		setupToken: number,
		operation: string,
	): void {
		if (this._generation !== gen || this._setupToken !== setupToken) {
			throw new InclusionLifecycleCancelledError(operation)
		}
	}

	private _assertCommand(
		gen: number,
		commandToken: number,
		operation: string,
	): void {
		if (!this._ownsCommand(gen, commandToken)) {
			throw new InclusionLifecycleCancelledError(operation)
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
		this._settlePendingPromises()
		this._socket.sendToSocket(this._socketEvents.inclusionAborted, true)

		this._controllerEvent.emitControllerEvent('inclusion aborted')

		this._logger.warn('Inclusion aborted')
	}
}
