/**
 * FirmwareUpdateService – owns all firmware update operations, state, caches,
 * timers, and socket emissions for both OTW (over-the-wire, controller) and
 * OTA (over-the-air, node) firmware updates.
 *
 * Extracted from ZwaveClient to keep the monolith slim.
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
	FirmwareUpdateInfo,
	FirmwareUpdateResult,
	FwFileRef,
	OTWFirmwareUpdateResult,
	ServiceLogger,
	StagedFirmwareNodeUpdate,
} from './ports.ts'

/**
 * Thrown when an in-flight firmware operation detects that the service
 * generation has advanced (reset/dispose happened while awaiting). This is
 * the explicit lifecycle cancellation error for firmware operations —
 * consistent with the repo's `DriverNotReadyError` pattern.
 */
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

	/** Stores nvmEvent label set before OTW backups */
	private _nvmEventSetter: ((event: string) => void) | undefined

	/**
	 * Generation counter — incremented on every dispose() so that an
	 * in-flight async operation can detect that a close/restart happened
	 * and bail out rather than persisting stale results or rescheduling.
	 */
	private _generation = 0

	/** Whether this service instance has been disposed */
	private _disposed = false

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

	/** Current generation (incremented on dispose/reset) — exposed for testing */
	get generation(): number {
		return this._generation
	}

	/** Whether this instance has been disposed */
	get disposed(): boolean {
		return this._disposed
	}

	/**
	 * Dispose this service instance: cancel pending timers, increment
	 * generation so in-flight operations bail out. Once disposed, no new
	 * scheduled checks will fire from this instance.
	 */
	dispose(): void {
		this._disposed = true
		this._generation++
		this.clearScheduledCheck()
	}

	/**
	 * Reset the service generation without full disposal — used when the
	 * same instance is reused across a soft restart. Cancels timers and
	 * increments generation fence.
	 */
	resetGeneration(): void {
		this._generation++
		this.clearScheduledCheck()
	}

	/**
	 * Assert that the current generation matches the captured generation and
	 * the service is not disposed. Throws `FirmwareLifecycleCancelledError`
	 * if the fence is broken — never allows silent success on stale operations.
	 */
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

		// Fence: stale results must not be returned after reset/dispose
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

		// Fence: stale results must not be returned after reset/dispose
		this._assertFence(gen, 'getAllAvailableFirmwareUpdates')

		return result
	}

	/**
	 * Check firmware updates for all nodes and store results in nodes.json.
	 * Generation-fenced: throws FirmwareLifecycleCancelledError if disposed/reset.
	 *
	 * Stages firmware-node projections without mutating shared storeNodes/ZUINode
	 * or emitting. Persists the staged snapshot, asserts fence, then atomically
	 * applies to shared in-memory state and emits. If fence breaks while
	 * persistence is pending, no shared store mutation, node mutation, or emit
	 * occurs.
	 */
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

			// Generation fence after await: do not mutate store/cache
			// if a close/reset happened while the request was in flight.
			this._assertFence(gen, 'checkAllNodesFirmwareUpdates')

			if (result) {
				const now = Date.now()

				// Stage projections without mutating shared state
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

				// Persist staged snapshot (writes to store + disk)
				await this._nodes.persistStagedNodeUpdates(staged)

				// Fence after persistence: if reset raced, do not apply
				// to shared in-memory state or emit.
				this._assertFence(gen, 'checkAllNodesFirmwareUpdates')

				// Atomically apply to shared in-memory state and emit
				for (const projection of staged) {
					this._applyNodeFirmwareProjection(projection)
				}
			}

			return result
		} catch (error) {
			// Propagate lifecycle cancellation without logging as unexpected error
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

	/**
	 * Dismiss firmware update for a specific node and version
	 */
	async dismissFirmwareUpdate(
		nodeId: number,
		version: string,
	): Promise<boolean> {
		const gen = this._generation
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

		await this._nodes.updateStoreNodes()
		this._assertFence(gen, 'dismissFirmwareUpdate')
		this._logger.info(
			`Dismissed firmware update ${version} for node ${nodeId}`,
		)

		return true
	}

	/**
	 * Get available non-dismissed firmware updates for a node
	 */
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

	/**
	 * Start OTA firmware update for a node using update info
	 */
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

		// Fence: do not return result to caller if reset happened —
		// the result belongs to a previous lifecycle.
		this._assertFence(gen, 'firmwareUpdateOTA')

		return result
	}

	/**
	 * OTW (over-the-wire) firmware update for the controller
	 */
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

				// Fence after backup: never let an OTW operation paused in
				// backup call a replacement driver.
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

				// Fence after extraction: never let extraction paused across
				// reset call stale node update.
				this._assertFence(gen, 'firmwareUpdateOTW')

				firmwareData = firmware.data
			} catch (e) {
				// Re-throw lifecycle cancellation as-is
				if (e instanceof FirmwareLifecycleCancelledError) {
					throw e
				}
				throw Error(
					`Unable to extract firmware from file '${file.name}'`,
				)
			}

			const result = await drv.firmwareUpdateOTW(firmwareData)
			// Fence after driver call before returning result
			this._assertFence(gen, 'firmwareUpdateOTW')
			return result
		} catch (e) {
			// Propagate lifecycle cancellation without wrapping
			if (e instanceof FirmwareLifecycleCancelledError) {
				throw e
			}
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

					// Fence after extraction: never let extraction paused
					// across reset call stale node update.
					this._assertFence(gen, 'updateFirmware')

					if (f.target !== undefined) {
						firmware.firmwareTarget = f.target
					}
					firmwares.push(firmware)
				} catch (e) {
					// Propagate lifecycle cancellation without wrapping
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

		// Final fence before calling into the (possibly replaced) node
		this._assertFence(gen, 'updateFirmware')

		const result = await zwaveNode.updateFirmware(firmwares)

		// Fence after long-running update completes
		this._assertFence(gen, 'updateFirmware')

		return result
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

		const gen = this._generation

		await zwaveNode.abortFirmwareUpdate()

		// Fence: never let abort completion mutate node/socket after reset
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

	/**
	 * Schedule periodic firmware update checks.
	 * Uses generation fencing: if close/reset happens during the await,
	 * the method bails out without persisting stale results or rescheduling.
	 */
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

		// Generation fence: if disposed or reset happened during the check,
		// do NOT reschedule — the old generation must not produce new timers.
		if (this._generation !== gen || this._disposed) {
			return
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
	 * Check firmware updates for a specific node after an event.
	 * Generation-fenced: throws FirmwareLifecycleCancelledError if disposed/reset.
	 *
	 * Stages firmware-node projection without mutating shared state. Persists,
	 * fences, then atomically applies and emits.
	 */
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

			// Generation fence after await
			this._assertFence(gen, 'checkNodeFirmwareUpdates')

			const filteredUpdates = this._filterFirmwareUpdates(updates)
			const timestamp = Date.now()

			// Stage projection without mutating shared state
			const projection = this._computeNodeFirmwareProjection(
				nodeId,
				filteredUpdates,
				timestamp,
			)

			// Persist staged snapshot
			await this._nodes.persistStagedNodeUpdates([projection])

			// Fence after persistence
			this._assertFence(gen, 'checkNodeFirmwareUpdates')

			// Atomically apply to shared in-memory state and emit
			this._applyNodeFirmwareProjection(projection)

			this._logger.info(
				`Checked firmware updates for node ${nodeId} after update completion. Found ${filteredUpdates.length} update(s)`,
			)
		} catch (error) {
			// Lifecycle cancellation is expected — don't log as failure
			if (error instanceof FirmwareLifecycleCancelledError) {
				return
			}
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

	/**
	 * Filter firmware updates to remove downgrades
	 */
	private _filterFirmwareUpdates(
		updates: FirmwareUpdateInfo[] | null,
	): FirmwareUpdateInfo[] {
		return (updates || []).filter((update) => !update.downgrade)
	}

	/**
	 * Clean up dismissed updates map to only contain versions that exist
	 */
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

	/**
	 * Compute a staged firmware-node projection without mutating shared state.
	 * Uses existing storeNode dismissed data to compute clean dismissed set.
	 */
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

	/**
	 * Atomically apply a staged firmware projection to the shared in-memory
	 * node state (both ZUINode and storeNode) and emit the update. Called only
	 * after persistence succeeds and fence holds.
	 */
	private _applyNodeFirmwareProjection(
		projection: StagedFirmwareNodeUpdate,
	): void {
		// Update the persisted store node (shared in-memory storeNodes cache)
		const storeNode = this._nodes.ensureStoreNode(projection.nodeId)
		storeNode.availableFirmwareUpdates = projection.availableFirmwareUpdates
		storeNode.lastFirmwareUpdateCheck = projection.lastFirmwareUpdateCheck
		storeNode.firmwareUpdatesDismissed = projection.firmwareUpdatesDismissed

		// Update the live ZUINode and emit
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

	/**
	 * Update node firmware information in store and memory.
	 * Used by paths that do not need deferred persistence (e.g. dismissFirmwareUpdate)
	 * where mutation + emit is fine before persistence since those are user-initiated
	 * synchronous flows with their own fence.
	 */
	private _updateNodeFirmwareInfo(
		nodeId: number,
		filteredUpdates: FirmwareUpdateInfo[],
		timestamp: number,
	): void {
		const storeNode = this._nodes.ensureStoreNode(nodeId)

		storeNode.availableFirmwareUpdates = filteredUpdates
		storeNode.lastFirmwareUpdateCheck = timestamp

		const existingDismissed = storeNode.firmwareUpdatesDismissed || {}
		const cleanedDismissed = this._cleanDismissedUpdates(
			filteredUpdates,
			existingDismissed,
		)
		storeNode.firmwareUpdatesDismissed = cleanedDismissed

		const node = this._nodes.getNode(nodeId)
		if (node) {
			node.availableFirmwareUpdates = filteredUpdates
			node.lastFirmwareUpdateCheck = timestamp
			node.firmwareUpdatesDismissed = cleanedDismissed

			this._nodes.emitNodeUpdate(node, {
				availableFirmwareUpdates: node.availableFirmwareUpdates,
				lastFirmwareUpdateCheck: node.lastFirmwareUpdateCheck,
				firmwareUpdatesDismissed: node.firmwareUpdatesDismissed,
			})
		}
	}
}
