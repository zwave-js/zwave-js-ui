import useBaseStore from '../stores/base.js'
import { manager, instances } from './instanceManager'
import logger from './logger'

const log = logger.get('FirmwareUpdateChecker')

export class FirmwareUpdateChecker {
	constructor() {
		this.checkInterval = null
		this.isChecking = false
		this.intervalMinutes = 60 // Default: check every hour
	}

	/**
	 * Start the periodic firmware update checker
	 * @param {number} intervalMinutes - Check interval in minutes
	 */
	start(intervalMinutes = 60) {
		this.stop() // Stop any existing interval
		this.intervalMinutes = intervalMinutes

		log.info(
			`Starting firmware update checker with ${intervalMinutes} minute interval`,
		)

		// Initial check after a short delay
		setTimeout(() => this.checkAllFirmwareUpdates(), 30000)

		// Set up periodic checks
		this.checkInterval = setInterval(
			() => {
				this.checkAllFirmwareUpdates()
			},
			intervalMinutes * 60 * 1000,
		)
	}

	/**
	 * Stop the periodic firmware update checker
	 */
	stop() {
		if (this.checkInterval) {
			clearInterval(this.checkInterval)
			this.checkInterval = null
			log.info('Firmware update checker stopped')
		}
	}

	/**
	 * Manually trigger a firmware update check for all nodes
	 */
	async checkAllFirmwareUpdates() {
		if (this.isChecking) {
			log.debug('Firmware update check already in progress, skipping')
			return
		}

		try {
			this.isChecking = true
			log.info('Starting bulk firmware update check')

			const store = useBaseStore()
			const app = manager.getInstance(instances.APP)
			const response = await app.apiRequest(
				'getAllAvailableFirmwareUpdates',
				[],
			)

			if (response.success && response.result) {
				const allUpdates = response.result
				const now = Date.now()

				// Process results and update store
				Object.keys(allUpdates).forEach((nodeIdStr) => {
					const nodeId = parseInt(nodeIdStr)
					const nodeUpdates = allUpdates[nodeIdStr]

					if (nodeUpdates && nodeUpdates.length > 0) {
						// Check if this is a new update or same as before
						const currentStatus =
							store.firmwareUpdatesStatus[nodeId]
						const hasNewUpdates =
							!currentStatus ||
							!currentStatus.available ||
							!this.areUpdatesEqual(
								currentStatus.available,
								nodeUpdates,
							)

						// Only update if there are new updates or if dismissed flag should be reset
						if (hasNewUpdates) {
							store.setFirmwareUpdatesStatus(nodeId, {
								available: nodeUpdates,
								dismissed: false, // Reset dismissed flag for new updates
								lastCheck: now,
							})
							log.info(
								`Found ${nodeUpdates.length} firmware update(s) for node ${nodeId}`,
							)
						} else if (currentStatus.lastCheck) {
							// Just update the last check time if no new updates
							store.setFirmwareUpdatesStatus(nodeId, {
								lastCheck: now,
							})
						}
					} else {
						// No updates available, update status
						store.setFirmwareUpdatesStatus(nodeId, {
							available: [],
							lastCheck: now,
						})
					}
				})

				log.info('Bulk firmware update check completed')
			} else {
				log.error(
					'Failed to check firmware updates:',
					response.message || 'Unknown error',
				)
			}
		} catch (error) {
			log.error('Error during firmware update check:', error.message)
		} finally {
			this.isChecking = false
		}
	}

	/**
	 * Compare two arrays of firmware updates to see if they're the same
	 */
	areUpdatesEqual(updates1, updates2) {
		if (!updates1 || !updates2 || updates1.length !== updates2.length) {
			return false
		}

		// Sort by version for comparison
		const sorted1 = [...updates1].sort((a, b) =>
			a.version.localeCompare(b.version),
		)
		const sorted2 = [...updates2].sort((a, b) =>
			a.version.localeCompare(b.version),
		)

		return sorted1.every((update1, index) => {
			const update2 = sorted2[index]
			return (
				update1.version === update2.version &&
				update1.channel === update2.channel
			)
		})
	}

	/**
	 * Get firmware update status for a specific node
	 */
	getNodeUpdateStatus(nodeId) {
		const store = useBaseStore()
		return store.firmwareUpdatesStatus[nodeId] || null
	}

	/**
	 * Dismiss firmware update notification for a node
	 */
	dismissNodeUpdate(nodeId) {
		const store = useBaseStore()
		store.dismissFirmwareUpdate(nodeId)
		log.info(`Dismissed firmware update notification for node ${nodeId}`)
	}
}

// Create singleton instance
export const firmwareUpdateChecker = new FirmwareUpdateChecker()
