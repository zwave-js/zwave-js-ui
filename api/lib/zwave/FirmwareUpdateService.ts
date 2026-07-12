/**
 * FirmwareUpdateService – owns all firmware update operations, state, caches,
 * timers, and socket emissions for both OTW (over-the-wire, controller) and
 * OTA (over-the-air, node) firmware updates.
 *
 * Extracted from ZwaveClient to keep the monolith slim. The service is
 * strict-clean (no `any` casts, no non-null assertions, no ts-ignore).
 *
 * Ports:
 *   driver      – driver + controller access for firmware operations
 *   nodes       – node store read/write for firmware state
 *   socket      – socket emission + throttling
 *   config      – runtime config (disableAutomaticFirmwareUpdateChecks)
 *   backup      – NVM backup before OTW updates
 *   extraction  – firmware file parsing/extraction utilities
 *   logger      – structured logging
 */

import { getErrorMessage } from '../errors.ts'
import type {
	FirmwareBackupPort,
	FirmwareConfigPort,
	FirmwareDriverPort,
	FirmwareExtractionPort,
	FirmwareFileFormat,
	FirmwareNodeStorePort,
	FirmwareSocketPort,
	FirmwareUpdateInfoRef,
	FirmwareUpdateNodeState,
	FwFileRef,
	ServiceLogger,
} from './ports.ts'

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

	/** Stores nvmEvent label set before OTW backups */
	private _nvmEventSetter: ((event: string) => void) | undefined

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

	// ---------------------------------------------------------------
	// Public API
	// ---------------------------------------------------------------

	async getAvailableFirmwareUpdates(
		nodeId: number,
		options?: unknown,
	): Promise<FirmwareUpdateInfoRef[] | null> {
		const drv = this._driver.getDriver()
		if (!drv || !this._driver.isDriverReady()) {
			throw new Error('Driver is not ready')
		}

		const result = await drv.controller.getAvailableFirmwareUpdates(
			nodeId,
			options,
		)

		return result
	}

	async getAllAvailableFirmwareUpdates(
		options?: unknown,
	): Promise<Map<number, FirmwareUpdateInfoRef[]> | null> {
		const drv = this._driver.getDriver()
		if (!drv || !this._driver.isDriverReady()) {
			throw new Error('Driver is not ready')
		}

		const result =
			await drv.controller.getAllAvailableFirmwareUpdates(options)

		return result
	}

	/**
	 * Check firmware updates for all nodes and store results in nodes.json
	 */
	async checkAllNodesFirmwareUpdates(
		options?: unknown,
	): Promise<Map<number, FirmwareUpdateInfoRef[]> | null | undefined> {
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

		this._logger.info('Starting bulk firmware update check for all nodes')

		try {
			const result =
				await drv.controller.getAllAvailableFirmwareUpdates(options)

			if (result) {
				const now = Date.now()

				for (const [nodeId, nodeUpdates] of result) {
					const filteredUpdates =
						this._filterFirmwareUpdates(nodeUpdates)

					this._updateNodeFirmwareInfo(nodeId, filteredUpdates, now)

					if (filteredUpdates && filteredUpdates.length > 0) {
						this._logger.info(
							`Found ${filteredUpdates.length} firmware update(s) for node ${nodeId}`,
						)
					}
				}

				// Save to nodes.json
				await this._nodes.updateStoreNodes()
			}

			return result
		} catch (error) {
			this._logger.error(
				'Error during bulk firmware update check:',
				getErrorMessage(error),
			)
			throw error
		}
	}

	/**
	 * Dismiss firmware update for a specific node and version
	 */
	async dismissFirmwareUpdate(
		nodeId: number,
		version: string,
	): Promise<boolean> {
		// Ensure store entry exists
		const storeNode = this._nodes.ensureStoreNode(nodeId)

		// Initialize dismissal tracking if not exists
		if (!storeNode.firmwareUpdatesDismissed) {
			storeNode.firmwareUpdatesDismissed = {}
		}

		// Mark version as dismissed
		storeNode.firmwareUpdatesDismissed[version] = true

		// Update in-memory node
		const node = this._nodes.getNode(nodeId)
		if (node) {
			if (!node.firmwareUpdatesDismissed) {
				node.firmwareUpdatesDismissed = {}
			}
			node.firmwareUpdatesDismissed[version] = true

			// Emit update to frontend
			this._nodes.emitNodeUpdate(node, {
				firmwareUpdatesDismissed: node.firmwareUpdatesDismissed,
			})
		}

		// Save to nodes.json
		await this._nodes.updateStoreNodes()
		this._logger.info(
			`Dismissed firmware update ${version} for node ${nodeId}`,
		)

		return true
	}

	/**
	 * Get available non-dismissed firmware updates for a node
	 */
	getNodeFirmwareUpdates(nodeId: number): FirmwareUpdateInfoRef[] {
		const node = this._nodes.getNode(nodeId)
		if (!node?.availableFirmwareUpdates) {
			return []
		}

		// Filter out dismissed updates
		return node.availableFirmwareUpdates.filter((update) => {
			const dismissed =
				node.firmwareUpdatesDismissed?.[update.version] || false
			return !dismissed
		})
	}

	/**
	 * Start OTA firmware update for a node using update info
	 */
	async firmwareUpdateOTA(
		nodeId: number,
		updateInfo: FirmwareUpdateInfoRef,
	): Promise<unknown> {
		const drv = this._driver.getDriver()
		if (!drv || !this._driver.isDriverReady()) {
			throw new Error('Driver is not ready')
		}

		const node = this._nodes.getNode(nodeId)

		if (node?.firmwareUpdate) {
			throw Error(`Firmware update already in progress`)
		}

		const result = await drv.controller.firmwareUpdateOTA(
			nodeId,
			updateInfo,
		)

		return result
	}

	/**
	 * OTW (over-the-wire) firmware update for the controller
	 */
	async firmwareUpdateOTW(
		file: FwFileRef | FirmwareUpdateInfoRef,
	): Promise<unknown> {
		try {
			if (this._backup.backupOnEvent) {
				if (this._nvmEventSetter) {
					this._nvmEventSetter('before_controller_fw_update_otw')
				}
				await this._backup.backupNvm()
			}

			const drv = this._driver.getDriver()
			if (!drv) {
				throw new Error('Driver is not ready')
			}

			// If it has `files` property, it's a FirmwareUpdateInfo — pass
			// it directly (the driver signature accepts both data and info).
			if ('files' in file && Array.isArray(file.files)) {
				const info: FirmwareUpdateInfoRef = file
				return await drv.firmwareUpdateOTW(info)
			}

			const fwFile = file as FwFileRef

			let firmwareData: Uint8Array<ArrayBuffer>
			try {
				const format = this._extraction.guessFirmwareFileFormat(
					fwFile.name,
					fwFile.data,
				)
				const firmware = await this._extraction.extractFirmware(
					fwFile.data,
					format,
				)
				firmwareData = firmware.data
			} catch {
				throw Error(
					`Unable to extract firmware from file '${fwFile.name}'`,
				)
			}

			const result = await drv.firmwareUpdateOTW(firmwareData)
			return result
		} catch (e) {
			throw Error(`Error while updating firmware: ${getErrorMessage(e)}`)
		}
	}

	/**
	 * Update firmware on a specific node using file(s)
	 */
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
					): Promise<unknown>
			  }
			| undefined,
	): Promise<unknown> {
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
					if (f.target !== undefined) {
						firmware.firmwareTarget = f.target
					}
					firmwares.push(firmware)
				} catch (e) {
					throw Error(
						`Unable to extract firmware from file '${name}': ${getErrorMessage(e)}`,
					)
				}
			} else {
				throw Error(`Invalid firmware file ${name} is not a Buffer`)
			}
		}

		return zwaveNode.updateFirmware(firmwares)
	}

	/**
	 * Abort firmware update on a specific node
	 */
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

		await zwaveNode.abortFirmwareUpdate()

		const node = this._nodes.getNode(nodeId)

		// reset fw update progress
		if (node) {
			node.firmwareUpdate = undefined

			this._nodes.emitNodeUpdate(node, {
				firmwareUpdate: false,
			} as DeepPartial<FirmwareUpdateNodeState>)
		}
	}

	// ---------------------------------------------------------------
	// Node firmware update progress/finished callbacks
	// ---------------------------------------------------------------

	/**
	 * Handle node firmware update progress event
	 */
	onNodeFirmwareUpdateProgress(nodeId: number, progress: unknown): void {
		const node = this._nodes.getNode(nodeId)
		if (node) {
			node.firmwareUpdate = progress
			// send at most 4msg per second
			this._socket.throttle(
				'_onNodeFirmwareUpdateProgress_' + node.id,
				() => {
					this._nodes.emitNodeUpdate(node, {
						firmwareUpdate: progress,
					} as DeepPartial<FirmwareUpdateNodeState>)
				},
				250,
			)
		}
	}

	/**
	 * Handle node firmware update finished event
	 */
	onNodeFirmwareUpdateFinished(nodeId: number): void {
		const node = this._nodes.getNode(nodeId)
		if (node) {
			node.firmwareUpdate = undefined

			this._socket.clearThrottle(
				'_onNodeFirmwareUpdateProgress_' + node.id,
			)

			this._nodes.emitNodeUpdate(node, {
				firmwareUpdate: false,
			} as DeepPartial<FirmwareUpdateNodeState>)
		}
	}

	// ---------------------------------------------------------------
	// OTW firmware update callbacks
	// ---------------------------------------------------------------

	/**
	 * Handle OTW firmware update progress event
	 */
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

	/**
	 * Handle OTW firmware update finished event
	 */
	onOTWFirmwareUpdateFinished(
		result: { success: boolean; status: number },
		statusName: string,
		otwSocketEvent: string,
	): void {
		// prevent progress event to come after finish
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

	// ---------------------------------------------------------------
	// Scheduled firmware update check
	// ---------------------------------------------------------------

	/**
	 * Schedule periodic firmware update checks
	 */
	async scheduledFirmwareUpdateCheck(): Promise<void> {
		if (this._config.disableAutomaticFirmwareUpdateChecks) {
			this._logger.info('Automatic firmware update checks are disabled')
			return
		}

		try {
			await this.checkAllNodesFirmwareUpdates()
		} catch (error) {
			this._logger.warn(
				`Scheduled firmware update check has failed: ${getErrorMessage(error)}`,
			)
		}

		// Schedule next check for a random delay between 23 and 25 hours
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
				/* ignore */
			})
		}, waitMillis)
	}

	/**
	 * Check firmware updates for a specific node after an event
	 */
	async checkNodeFirmwareUpdates(nodeId: number): Promise<void> {
		if (!this._driver.isDriverReady()) {
			return
		}

		if (this._config.disableAutomaticFirmwareUpdateChecks) {
			this._logger.info(
				`Firmware update checks are disabled. Skipping check for node ${nodeId}.`,
			)
			return
		}

		try {
			const drv = this._driver.getDriver()
			if (!drv) {
				return
			}

			const updates =
				await drv.controller.getAvailableFirmwareUpdates(nodeId)

			const filteredUpdates = this._filterFirmwareUpdates(updates)
			const timestamp = Date.now()

			this._updateNodeFirmwareInfo(nodeId, filteredUpdates, timestamp)

			await this._nodes.updateStoreNodes()

			this._logger.info(
				`Checked firmware updates for node ${nodeId} after update completion. Found ${filteredUpdates.length} update(s)`,
			)
		} catch (error) {
			this._logger.error(
				`Failed to check firmware updates for node ${nodeId} after update: ${getErrorMessage(error)}`,
			)
		}
	}

	/**
	 * Clear the scheduled firmware update check timeout
	 */
	clearScheduledCheck(): void {
		if (this._firmwareUpdateCheckTimeout) {
			clearTimeout(this._firmwareUpdateCheckTimeout)
			this._firmwareUpdateCheckTimeout = null
		}
	}

	// ---------------------------------------------------------------
	// Private helpers
	// ---------------------------------------------------------------

	/**
	 * Filter firmware updates to remove downgrades
	 */
	private _filterFirmwareUpdates(
		updates: FirmwareUpdateInfoRef[] | null,
	): FirmwareUpdateInfoRef[] {
		return (updates || []).filter((update) => !update.downgrade)
	}

	/**
	 * Clean up dismissed updates map to only contain versions that exist
	 */
	private _cleanDismissedUpdates(
		filteredUpdates: FirmwareUpdateInfoRef[],
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

	/**
	 * Update node firmware information in store and memory
	 */
	private _updateNodeFirmwareInfo(
		nodeId: number,
		filteredUpdates: FirmwareUpdateInfoRef[],
		timestamp: number,
	): void {
		const storeNode = this._nodes.ensureStoreNode(nodeId)

		// Update stored firmware update info
		storeNode.availableFirmwareUpdates = filteredUpdates
		storeNode.lastFirmwareUpdateCheck = timestamp

		// Clean up dismissed updates map
		const existingDismissed = storeNode.firmwareUpdatesDismissed || {}
		const cleanedDismissed = this._cleanDismissedUpdates(
			filteredUpdates,
			existingDismissed,
		)
		storeNode.firmwareUpdatesDismissed = cleanedDismissed

		// Update in-memory node
		const node = this._nodes.getNode(nodeId)
		if (node) {
			node.availableFirmwareUpdates = filteredUpdates
			node.lastFirmwareUpdateCheck = timestamp
			node.firmwareUpdatesDismissed = cleanedDismissed

			// Emit update to frontend
			this._nodes.emitNodeUpdate(node, {
				availableFirmwareUpdates: node.availableFirmwareUpdates,
				lastFirmwareUpdateCheck: node.lastFirmwareUpdateCheck,
				firmwareUpdatesDismissed: node.firmwareUpdatesDismissed,
			})
		}
	}
}

// Re-export for convenience — avoids needing a separate import of the type
// alias from ports.ts in the wiring layer.
type DeepPartial<T> = {
	[P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}
