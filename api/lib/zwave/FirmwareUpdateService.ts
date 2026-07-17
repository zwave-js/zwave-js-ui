import { getErrorMessage } from '../errors.ts'
import type {
	FirmwareBackupPort,
	FirmwareConfigPort,
	FirmwareDriverPort,
	FirmwareExtractionPort,
	FirmwareFileFormat,
	FirmwareNodeStorePort,
	FirmwarePersistenceRestore,
	FirmwareSocketPort,
	FirmwareUpdateInfo,
	FirmwareUpdateResult,
	FwFileRef,
	OTWFirmwareUpdateResult,
	ServiceLogger,
	StagedFirmwareNodeUpdate,
} from './ports.ts'

export class FirmwareLifecycleCancelledError extends Error {
	constructor(operation: string) {
		super(
			`Firmware operation "${operation}" cancelled: service generation advanced`,
		)
		this.name = 'FirmwareLifecycleCancelledError'
	}
}

export class FirmwareUpdateService {
	private readonly _driver: FirmwareDriverPort
	private readonly _nodes: FirmwareNodeStorePort
	private readonly _socket: FirmwareSocketPort
	private readonly _config: FirmwareConfigPort
	private readonly _backup: FirmwareBackupPort
	private readonly _extraction: FirmwareExtractionPort
	private readonly _logger: ServiceLogger

	private _firmwareUpdateCheckTimeout: ReturnType<typeof setTimeout> | null =
		null

	private _nvmEventSetter: ((event: string) => void) | undefined

	// Advance on reset so suspended work cannot publish into a new lifecycle
	private _generation = 0

	private _disposed = false
	private _persistenceTail: Promise<void> = Promise.resolve()

	constructor(
		driver: FirmwareDriverPort,
		nodes: FirmwareNodeStorePort,
		socket: FirmwareSocketPort,
		config: FirmwareConfigPort,
		backup: FirmwareBackupPort,
		extraction: FirmwareExtractionPort,
		logger: ServiceLogger,
		nvmEventSetter?: (event: string) => void,
	) {
		this._driver = driver
		this._nodes = nodes
		this._socket = socket
		this._config = config
		this._backup = backup
		this._extraction = extraction
		this._logger = logger
		this._nvmEventSetter = nvmEventSetter
	}

	dispose(): void {
		this._disposed = true
		this._generation++
		this.clearScheduledCheck()
	}

	resetGeneration(): void {
		this._generation++
		this.clearScheduledCheck()
	}

	private _assertFence(gen: number, operation: string): void {
		if (this._generation !== gen || this._disposed) {
			throw new FirmwareLifecycleCancelledError(operation)
		}
	}

	async getAvailableFirmwareUpdates(
		nodeId: number,
		options?: unknown,
	): Promise<FirmwareUpdateInfo[]> {
		const drv = this._driver.getDriver()
		if (!drv || !this._driver.isDriverReady()) {
			throw new Error('Driver is not ready')
		}

		const gen = this._generation

		const result = await drv.controller.getAvailableFirmwareUpdates(
			nodeId,
			options,
		)

		this._assertFence(gen, 'getAvailableFirmwareUpdates')

		return result
	}

	async getAllAvailableFirmwareUpdates(
		options?: unknown,
	): Promise<Map<number, FirmwareUpdateInfo[]>> {
		const drv = this._driver.getDriver()
		if (!drv || !this._driver.isDriverReady()) {
			throw new Error('Driver is not ready')
		}

		const gen = this._generation

		const result =
			await drv.controller.getAllAvailableFirmwareUpdates(options)

		this._assertFence(gen, 'getAllAvailableFirmwareUpdates')

		return result
	}

	async checkAllNodesFirmwareUpdates(
		options?: unknown,
	): Promise<Map<number, FirmwareUpdateInfo[]> | undefined> {
		const drv = this._driver.getDriver()
		if (!drv || !this._driver.isDriverReady()) {
			throw new Error('Driver is not ready')
		}

		if (this._config.disableAutomaticFirmwareUpdateChecks) {
			this._logger.info(
				'Firmware update checks are disabled. Skipping bulk firmware update check.',
			)
			return undefined
		}

		const gen = this._generation

		this._logger.info('Starting bulk firmware update check for all nodes')

		try {
			const result =
				await drv.controller.getAllAvailableFirmwareUpdates(options)

			this._assertFence(gen, 'checkAllNodesFirmwareUpdates')

			if (result) {
				const now = Date.now()

				const staged: StagedFirmwareNodeUpdate[] = []
				for (const [nodeId, nodeUpdates] of result) {
					const filteredUpdates =
						this._filterFirmwareUpdates(nodeUpdates)

					const projection = this._computeNodeFirmwareProjection(
						nodeId,
						filteredUpdates,
						now,
					)
					staged.push(projection)

					if (filteredUpdates && filteredUpdates.length > 0) {
						this._logger.info(
							`Found ${filteredUpdates.length} firmware update(s) for node ${nodeId}`,
						)
					}
				}

				// Persist a detached snapshot because filesystem writes cannot be cancelled after reset
				await this._persistAndApplyStagedNodeUpdates(
					staged,
					gen,
					'checkAllNodesFirmwareUpdates',
				)
			}

			return result
		} catch (error) {
			if (error instanceof FirmwareLifecycleCancelledError) {
				throw error
			}
			this._logger.error(
				'Error during bulk firmware update check:',
				getErrorMessage(error),
			)
			throw error
		}
	}

	async dismissFirmwareUpdate(
		nodeId: number,
		version: string,
	): Promise<boolean> {
		const gen = this._generation
		await this._serializePersistence(
			gen,
			'dismissFirmwareUpdate',
			async () => {
				const storeNode = this._nodes.ensureStoreNode(nodeId)

				if (!storeNode.firmwareUpdatesDismissed) {
					storeNode.firmwareUpdatesDismissed = {}
				}

				storeNode.firmwareUpdatesDismissed[version] = true

				const node = this._nodes.getNode(nodeId)
				if (node) {
					if (!node.firmwareUpdatesDismissed) {
						node.firmwareUpdatesDismissed = {}
					}
					node.firmwareUpdatesDismissed[version] = true

					this._nodes.emitNodeUpdate(node, {
						firmwareUpdatesDismissed: node.firmwareUpdatesDismissed,
					})
				}

				return this._nodes.updateStoreNodes()
			},
		)
		this._logger.info(
			`Dismissed firmware update ${version} for node ${nodeId}`,
		)

		return true
	}

	getNodeFirmwareUpdates(nodeId: number): FirmwareUpdateInfo[] {
		const node = this._nodes.getNode(nodeId)
		if (!node?.availableFirmwareUpdates) {
			return []
		}

		return node.availableFirmwareUpdates.filter((update) => {
			const dismissed =
				node.firmwareUpdatesDismissed?.[update.version] || false
			return !dismissed
		})
	}

	async firmwareUpdateOTA(
		nodeId: number,
		updateInfo: FirmwareUpdateInfo,
	): Promise<FirmwareUpdateResult> {
		const drv = this._driver.getDriver()
		if (!drv || !this._driver.isDriverReady()) {
			throw new Error('Driver is not ready')
		}

		const node = this._nodes.getNode(nodeId)

		if (node?.firmwareUpdate) {
			throw Error(`Firmware update already in progress`)
		}

		const gen = this._generation

		const result = await drv.controller.firmwareUpdateOTA(
			nodeId,
			updateInfo,
		)

		this._assertFence(gen, 'firmwareUpdateOTA')

		return result
	}

	async firmwareUpdateOTW(
		file: FwFileRef | FirmwareUpdateInfo,
	): Promise<OTWFirmwareUpdateResult> {
		const gen = this._generation

		try {
			if (this._backup.backupOnEvent) {
				if (this._nvmEventSetter) {
					this._nvmEventSetter('before_controller_fw_update_otw')
				}
				await this._backup.backupNvm()

				// Fence before resolving the driver because backup may overlap driver replacement
				this._assertFence(gen, 'firmwareUpdateOTW')
			}

			const drv = this._driver.getDriver()
			if (!drv) {
				throw new Error('Driver is not ready')
			}

			if ('files' in file) {
				const result = await drv.firmwareUpdateOTW(file)
				this._assertFence(gen, 'firmwareUpdateOTW')
				return result
			}

			let firmwareData: Uint8Array<ArrayBuffer>
			try {
				const format = this._extraction.guessFirmwareFileFormat(
					file.name,
					file.data,
				)
				const firmware = await this._extraction.extractFirmware(
					file.data,
					format,
				)

				// Fence extraction before using the driver captured for this lifecycle
				this._assertFence(gen, 'firmwareUpdateOTW')

				firmwareData = firmware.data
			} catch (e) {
				if (e instanceof FirmwareLifecycleCancelledError) {
					throw e
				}
				throw Error(
					`Unable to extract firmware from file '${file.name}'`,
				)
			}

			const result = await drv.firmwareUpdateOTW(firmwareData)
			this._assertFence(gen, 'firmwareUpdateOTW')
			return result
		} catch (e) {
			if (e instanceof FirmwareLifecycleCancelledError) {
				throw e
			}
			throw Error(`Error while updating firmware: ${getErrorMessage(e)}`)
		}
	}

	async updateFirmware(
		nodeId: number,
		files: FwFileRef[],
		getZwaveNode: (id: number) =>
			| {
					updateFirmware(
						fw: Array<{
							data: Uint8Array<ArrayBuffer>
							firmwareTarget?: number
						}>,
					): Promise<FirmwareUpdateResult>
			  }
			| undefined,
	): Promise<FirmwareUpdateResult> {
		if (!this._driver.isDriverReady()) {
			throw new Error('Driver is not ready')
		}

		const zwaveNode = getZwaveNode(nodeId)

		if (!zwaveNode) {
			throw Error(`Node ${nodeId} not found`)
		}

		const node = this._nodes.getNode(nodeId)

		if (node?.firmwareUpdate) {
			throw Error(`Firmware update already in progress`)
		}

		const gen = this._generation

		const firmwares: Array<{
			data: Uint8Array<ArrayBuffer>
			firmwareTarget?: number
		}> = []

		for (const f of files) {
			let { data, name } = f
			if (this._extraction.isUint8Array(data)) {
				try {
					let format: FirmwareFileFormat
					if (name.endsWith('.zip')) {
						const extracted =
							this._extraction.tryUnzipFirmwareFile(data)
						if (!extracted) {
							throw Error(
								`Unable to extract firmware from zip file '${name}'`,
							)
						}

						format = extracted.format
						name = extracted.filename
						data = extracted.rawData
					} else {
						format = this._extraction.guessFirmwareFileFormat(
							name,
							data,
						)
					}

					const firmware = await this._extraction.extractFirmware(
						data,
						format,
					)

					// Fence extracted files before using a node that restart may replace
					this._assertFence(gen, 'updateFirmware')

					if (f.target !== undefined) {
						firmware.firmwareTarget = f.target
					}
					firmwares.push(firmware)
				} catch (e) {
					if (e instanceof FirmwareLifecycleCancelledError) {
						throw e
					}
					throw Error(
						`Unable to extract firmware from file '${name}': ${getErrorMessage(e)}`,
					)
				}
			} else {
				throw Error(`Invalid firmware file ${name} is not a Buffer`)
			}
		}

		this._assertFence(gen, 'updateFirmware')

		const result = await zwaveNode.updateFirmware(firmwares)

		this._assertFence(gen, 'updateFirmware')

		return result
	}

	async abortFirmwareUpdate(
		nodeId: number,
		getZwaveNode: (
			id: number,
		) => { abortFirmwareUpdate(): Promise<void> } | undefined,
	): Promise<void> {
		if (!this._driver.isDriverReady()) {
			throw new Error('Driver is not ready')
		}

		const zwaveNode = getZwaveNode(nodeId)

		if (!zwaveNode) {
			throw Error(`Node ${nodeId} not found`)
		}

		const gen = this._generation

		await zwaveNode.abortFirmwareUpdate()

		// Fence completion before publishing state into a restarted client
		this._assertFence(gen, 'abortFirmwareUpdate')

		const node = this._nodes.getNode(nodeId)

		if (node) {
			node.firmwareUpdate = undefined

			this._nodes.emitNodeUpdate(node, {
				firmwareUpdate: false,
			})
		}
	}

	onNodeFirmwareUpdateProgress(nodeId: number, progress: unknown): void {
		const node = this._nodes.getNode(nodeId)
		if (node) {
			node.firmwareUpdate = progress
			this._socket.throttle(
				'_onNodeFirmwareUpdateProgress_' + node.id,
				() => {
					this._nodes.emitNodeUpdate(node, {
						firmwareUpdate: progress,
					})
				},
				250,
			)
		}
	}

	onNodeFirmwareUpdateFinished(nodeId: number): void {
		const node = this._nodes.getNode(nodeId)
		if (node) {
			node.firmwareUpdate = undefined

			this._socket.clearThrottle(
				'_onNodeFirmwareUpdateProgress_' + node.id,
			)

			this._nodes.emitNodeUpdate(node, {
				firmwareUpdate: false,
			})
		}
	}

	onOTWFirmwareUpdateProgress(
		progress: unknown,
		otwSocketEvent: string,
	): void {
		this._socket.throttle(
			'_onOTWFirmwareUpdateProgress',
			() => {
				this._socket.sendToSocket(otwSocketEvent, {
					progress,
				})
			},
			250,
		)
	}

	onOTWFirmwareUpdateFinished(
		result: { success: boolean; status: number },
		statusName: string,
		otwSocketEvent: string,
	): void {
		this._socket.clearThrottle('_onOTWFirmwareUpdateProgress')

		this._socket.sendToSocket(otwSocketEvent, {
			result: {
				success: result.success,
				status: statusName,
			},
		})

		this._logger.info(
			`Controller firmware update OTW finished ${
				result.success ? 'successfully' : 'with error'
			}.\n   Status: ${statusName}. Result: ${JSON.stringify(result)}.`,
		)
	}

	async scheduledFirmwareUpdateCheck(): Promise<void> {
		if (this._disposed) {
			return
		}

		if (this._config.disableAutomaticFirmwareUpdateChecks) {
			this._logger.info('Automatic firmware update checks are disabled')
			return
		}

		const gen = this._generation

		try {
			await this.checkAllNodesFirmwareUpdates()
		} catch (error) {
			this._logger.warn(
				`Scheduled firmware update check has failed: ${getErrorMessage(error)}`,
			)
		}

		// Skip rescheduling after reset to prevent duplicate loops
		if (this._generation !== gen || this._disposed) {
			return
		}

		const minHours = 23
		const maxHours = 25
		const randomHours = minHours + Math.random() * (maxHours - minHours)
		const waitMillis = randomHours * 60 * 60 * 1000

		const nextCheckTime = new Date(Date.now() + waitMillis)
		this._logger.info(
			`Next firmware update check scheduled for: ${nextCheckTime}`,
		)

		this._firmwareUpdateCheckTimeout = setTimeout(() => {
			this.scheduledFirmwareUpdateCheck().catch(() => {
				// Prevent unexpected timer callback failures from surfacing as unhandled rejections
			})
		}, waitMillis)
	}

	async checkNodeFirmwareUpdates(nodeId: number): Promise<void> {
		if (!this._driver.isDriverReady() || this._disposed) {
			return
		}

		if (this._config.disableAutomaticFirmwareUpdateChecks) {
			this._logger.info(
				`Firmware update checks are disabled. Skipping check for node ${nodeId}.`,
			)
			return
		}

		const gen = this._generation

		try {
			const drv = this._driver.getDriver()
			if (!drv) {
				return
			}

			const updates =
				await drv.controller.getAvailableFirmwareUpdates(nodeId)

			this._assertFence(gen, 'checkNodeFirmwareUpdates')

			const filteredUpdates = this._filterFirmwareUpdates(updates)
			const timestamp = Date.now()

			const projection = this._computeNodeFirmwareProjection(
				nodeId,
				filteredUpdates,
				timestamp,
			)

			// Persist a detached snapshot because filesystem writes cannot be cancelled after reset
			await this._persistAndApplyStagedNodeUpdates(
				[projection],
				gen,
				'checkNodeFirmwareUpdates',
			)

			this._logger.info(
				`Checked firmware updates for node ${nodeId} after update completion. Found ${filteredUpdates.length} update(s)`,
			)
		} catch (error) {
			if (error instanceof FirmwareLifecycleCancelledError) {
				return
			}
			this._logger.error(
				`Failed to check firmware updates for node ${nodeId} after update: ${getErrorMessage(error)}`,
			)
		}
	}

	clearScheduledCheck(): void {
		if (this._firmwareUpdateCheckTimeout) {
			clearTimeout(this._firmwareUpdateCheckTimeout)
			this._firmwareUpdateCheckTimeout = null
		}
	}

	private _filterFirmwareUpdates(
		updates: FirmwareUpdateInfo[] | null,
	): FirmwareUpdateInfo[] {
		return (updates || []).filter((update) => !update.downgrade)
	}

	private async _persistAndApplyStagedNodeUpdates(
		staged: ReadonlyArray<StagedFirmwareNodeUpdate>,
		gen: number,
		operation: string,
	): Promise<void> {
		await this._serializePersistence(
			gen,
			operation,
			() => this._nodes.persistStagedNodeUpdates(staged),
			() => {
				for (const projection of staged) {
					const storeNode = this._nodes.getStoreNode(
						projection.nodeId,
					)
					this._applyNodeFirmwareProjection({
						...projection,
						firmwareUpdatesDismissed: this._cleanDismissedUpdates(
							projection.availableFirmwareUpdates,
							storeNode?.firmwareUpdatesDismissed || {},
						),
					})
				}
			},
		)
	}

	private async _serializePersistence(
		gen: number,
		operation: string,
		persist: () => Promise<FirmwarePersistenceRestore | void>,
		publish?: () => void,
	): Promise<void> {
		const persistence = this._persistenceTail.then(async () => {
			this._assertFence(gen, operation)
			const restore = await persist()

			if (this._generation !== gen || this._disposed) {
				// Restore current state because an in-flight filesystem write cannot be cancelled
				if (restore) {
					await restore()
				} else {
					await this._nodes.updateStoreNodes()
				}
			}

			this._assertFence(gen, operation)
			publish?.()
		})

		this._persistenceTail = persistence.catch(() => undefined)
		await persistence
	}

	private _cleanDismissedUpdates(
		filteredUpdates: FirmwareUpdateInfo[],
		existingDismissed: { [version: string]: boolean },
	): { [version: string]: boolean } {
		const cleanedDismissed: { [version: string]: boolean } = {}

		for (const update of filteredUpdates) {
			if (existingDismissed[update.version]) {
				cleanedDismissed[update.version] = true
			}
		}

		return cleanedDismissed
	}

	private _computeNodeFirmwareProjection(
		nodeId: number,
		filteredUpdates: FirmwareUpdateInfo[],
		timestamp: number,
	): StagedFirmwareNodeUpdate {
		const storeNode = this._nodes.getStoreNode(nodeId)
		const existingDismissed = storeNode?.firmwareUpdatesDismissed || {}
		const cleanedDismissed = this._cleanDismissedUpdates(
			filteredUpdates,
			existingDismissed,
		)

		return {
			nodeId,
			availableFirmwareUpdates: filteredUpdates,
			lastFirmwareUpdateCheck: timestamp,
			firmwareUpdatesDismissed: cleanedDismissed,
		}
	}

	private _applyNodeFirmwareProjection(
		projection: StagedFirmwareNodeUpdate,
	): void {
		const storeNode = this._nodes.ensureStoreNode(projection.nodeId)
		storeNode.availableFirmwareUpdates = projection.availableFirmwareUpdates
		storeNode.lastFirmwareUpdateCheck = projection.lastFirmwareUpdateCheck
		storeNode.firmwareUpdatesDismissed = projection.firmwareUpdatesDismissed

		const node = this._nodes.getNode(projection.nodeId)
		if (node) {
			node.availableFirmwareUpdates = projection.availableFirmwareUpdates
			node.lastFirmwareUpdateCheck = projection.lastFirmwareUpdateCheck
			node.firmwareUpdatesDismissed = projection.firmwareUpdatesDismissed

			this._nodes.emitNodeUpdate(node, {
				availableFirmwareUpdates: node.availableFirmwareUpdates,
				lastFirmwareUpdateCheck: node.lastFirmwareUpdateCheck,
				firmwareUpdatesDismissed: node.firmwareUpdatesDismissed,
			})
		}
	}
}
