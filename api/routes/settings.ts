import type express from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import { libVersion } from 'zwave-js'
import { serverVersion } from '@zwave-js/server'
import { getAllNamedScaleGroups, getAllSensors } from '@zwave-js/core'
import type { PersistedSettings } from '../config/store.ts'
import store from '../config/store.ts'
import { logsDir, sslDisabled } from '../config/app.ts'
import { GatewayType } from '../lib/Gateway.ts'
import type { ZwaveConfig } from '../lib/ZwaveClient.ts'
import jsonStore from '../lib/jsonStore.ts'
import * as loggers from '../lib/logger.ts'
import * as utils from '../lib/utils.ts'
import { getExternallyManagedPaths } from '../lib/externalSettings.ts'
import { getErrorMessage } from '../lib/errors.ts'
import type { AppRuntime } from '../runtime/AppRuntime.ts'
import { backupManagerOwner } from '../runtime/AppRuntime.ts'
import { isAuthenticated } from './auth.ts'

const logger = loggers.module('App')

/**
 * Reads a property from a Z-Wave settings object by a dynamically-computed
 * key name. `ZwaveConfig`/its `DeepPartial` have no index signature (every
 * property is individually declared), so a plain `config[key]` doesn't
 * type-check for an arbitrary `key: string` - this is the one narrow,
 * documented boundary where the settings blob is treated as a generic
 * string-keyed record for that dynamic lookup (used only to compare two
 * settings objects key-by-key for equality below, never to assign/validate).
 */
function getZwaveConfigValue(
	config: utils.DeepPartial<ZwaveConfig> | undefined,
	key: string,
): unknown {
	return (config as Record<string, unknown> | undefined)?.[key]
}

export interface SettingsRoutesDeps {
	apisLimiter: RateLimitRequestHandler
}

export function registerSettingsRoutes(
	app: express.Express,
	runtime: AppRuntime,
	{ apisLimiter }: SettingsRoutesDeps,
): void {
	// get settings
	app.get('/api/settings', apisLimiter, isAuthenticated, function (req, res) {
		const allSensors = getAllSensors()
		const namedScaleGroups = getAllNamedScaleGroups()

		const scales: ZwaveConfig['scales'] = []

		for (const group of namedScaleGroups) {
			for (const scale of Object.values(group.scales)) {
				scales.push({
					key: group.name,
					sensor: group.name,
					unit: scale.unit,
					label: scale.label,
					description: scale.description,
				})
			}
		}

		for (const sensor of allSensors) {
			for (const scale of Object.values(sensor.scales)) {
				scales.push({
					key: sensor.key,
					sensor: sensor.label,
					label: scale.label,
					unit: scale.unit,
					description: scale.description,
				})
			}
		}

		const settings = jsonStore.get(store.settings)

		const managedExternally: string[] = []
		if (process.env.ZWAVE_PORT) {
			managedExternally.push('zwave.port')
			managedExternally.push('zwave.enabled')
		}
		// Add paths from external settings file
		managedExternally.push(...getExternallyManagedPaths())

		const data = {
			success: true,
			settings,
			devices: runtime.getGateway()?.zwave?.devices ?? {},
			scales: scales,
			sslDisabled: sslDisabled(),
			managedExternally,
			tz: process.env.TZ,
			locale: process.env.LOCALE,
			deprecationWarning: process.env.TAG_NAME === 'zwavejs2mqtt',
		}

		res.json(data)
	})

	// get serial ports
	app.get(
		'/api/serial-ports',
		apisLimiter,
		isAuthenticated,
		async function (req, res) {
			let serial_ports: string[] = []

			// Only enumerate serial ports if ZWAVE_PORT is not set via env var
			if (process.platform !== 'sunos' && !process.env.ZWAVE_PORT) {
				try {
					serial_ports = await runtime.getEnumerateSerialPorts()({
						local: true,
						remote: true,
					})
				} catch (error) {
					logger.error(error)
					return res.json({ success: false, serial_ports })
				}
			}

			res.json({ success: true, serial_ports })
		},
	)

	// update settings
	app.post(
		'/api/settings',
		apisLimiter,
		isAuthenticated,
		async function (req, res) {
			try {
				if (runtime.isRestarting()) {
					throw Error(
						'Gateway is restarting, wait a moment before doing another request',
					)
				}
				let settings = req.body

				let shouldRestart = false
				let shouldRestartGw = false
				let shouldRestartZniffer = false
				let canUpdateZwaveOptions = false

				const actualSettings = jsonStore.get(store.settings)

				// TODO: validate settings using calss-validator
				// when settings is null consider a force restart
				if (settings && Object.keys(settings).length > 0) {
					// Check if gateway settings changed
					const gatewayChanged = !utils.deepEqual(
						actualSettings.gateway,
						settings.gateway,
					)
					const mqttChanged = !utils.deepEqual(
						actualSettings.mqtt,
						settings.mqtt,
					)

					if (gatewayChanged || mqttChanged) {
						shouldRestartGw = true
						shouldRestart = true
					}

					let changedZwaveKeys: string[] = []

					// Check if Z-Wave settings changed
					if (
						!utils.deepEqual(actualSettings.zwave, settings.zwave)
					) {
						// These are ZwaveClient configuration properties that map to
						// driver.updateOptions() parameters. The commented names show
						// the corresponding driver option keys:
						// - 'scales' maps to 'preferences.scales'
						// - 'logEnabled', 'logLevel', etc. map to 'logConfig' properties
						// - 'disableOptimisticValueUpdate' maps directly
						const editableZWaveSettings = [
							'disableOptimisticValueUpdate',
							// preferences
							'scales',
							// logConfig
							'logEnabled',
							'logLevel',
							'logToFile',
							'maxFiles',
							'nodeFilter',
						]

						// Find which Z-Wave settings actually changed
						// Only check keys that exist in actual settings to avoid detecting
						// new default properties added by the UI as "changed"
						const allKeys = new Set([
							...Object.keys(actualSettings.zwave || {}),
							...Object.keys(settings.zwave || {}),
						])
						changedZwaveKeys = Array.from(allKeys).filter((key) => {
							return !utils.deepEqual(
								getZwaveConfigValue(actualSettings.zwave, key),
								settings.zwave?.[key],
							)
						})

						logger.log('debug', 'Z-Wave settings changed: %o', {
							changedKeys: changedZwaveKeys,
							hasDriver: !!runtime.getGateway()?.zwave?.driver,
						})

						// Check if only editable options changed
						const onlyEditableChanged = changedZwaveKeys.every(
							(key) => editableZWaveSettings.includes(key),
						)

						logger.log(
							'debug',
							'Checking if can update without restart: %o',
							{
								onlyEditableChanged,
								changedKeysLength: changedZwaveKeys.length,
								hasDriver:
									!!runtime.getGateway()?.zwave?.driver,
							},
						)

						if (
							onlyEditableChanged &&
							changedZwaveKeys.length > 0 &&
							runtime.getGateway()?.zwave?.driver
						) {
							// Can update options without restart
							canUpdateZwaveOptions = true
							logger.info(
								'Z-Wave settings can be updated without restart',
							)
						} else {
							// Need full restart
							shouldRestartGw = true
							shouldRestart = true
							logger.info(
								'Z-Wave settings require full restart',
								{
									reason: !onlyEditableChanged
										? 'non-editable settings changed'
										: changedZwaveKeys.length === 0
											? 'no keys changed'
											: 'driver not available',
								},
							)
						}
					}

					// Check if Zniffer settings changed
					shouldRestartZniffer = !utils.deepEqual(
						actualSettings.zniffer,
						settings.zniffer,
					)
					if (shouldRestartZniffer) {
						shouldRestart = true
					}

					// Save settings to file
					await jsonStore.put(store.settings, settings)

					// Update driver options if only editable options changed
					// Freshly resolved (not reusing the pre-`await jsonStore.put`
					// checks above) - a concurrent restart could otherwise leave
					// this observing a stale gateway.
					const gwForDriverUpdate = runtime.getGateway()
					if (
						canUpdateZwaveOptions &&
						gwForDriverUpdate?.zwave?.driver
					) {
						try {
							// Build editable options object with only changed properties
							// Map our settings to PartialZWaveOptions format
							const editableOptions: any = {}

							// Check disableOptimisticValueUpdate
							if (
								changedZwaveKeys.includes(
									'disableOptimisticValueUpdate',
								) &&
								settings.zwave?.disableOptimisticValueUpdate !==
									undefined
							) {
								editableOptions.disableOptimisticValueUpdate =
									settings.zwave.disableOptimisticValueUpdate
							}

							// Check scales (maps to preferences.scales)
							if (
								changedZwaveKeys.includes('scales') &&
								settings.zwave?.scales !== undefined
							) {
								const preferences = utils.buildPreferences(
									settings.zwave || {},
								)
								if (preferences) {
									editableOptions.preferences = preferences
								}
							}

							// Check logConfig properties
							const logConfigChanged =
								[
									'logEnabled',
									'logLevel',
									'logToFile',
									'maxFiles',
									'nodeFilter',
								].filter((key) => {
									return (
										changedZwaveKeys.includes(key) &&
										settings.zwave?.[key] !== undefined
									)
								}).length > 0

							if (logConfigChanged) {
								// Build logConfig object from our settings
								editableOptions.logConfig =
									utils.buildLogConfig(
										settings.zwave || {},
										logsDir,
									)
							}

							if (Object.keys(editableOptions).length > 0) {
								gwForDriverUpdate.zwave.driver.updateOptions(
									editableOptions,
								)
								logger.info(
									'Updated Z-Wave driver options without restart:',
									Object.keys(editableOptions).join(', '),
								)
							}
						} catch (error) {
							logger.error('Error updating driver options', error)
							// If update fails, require restart
							shouldRestart = true
							shouldRestartGw = true
						}
					}
				} else {
					// Force restart if no settings provided
					shouldRestart = true
					settings = actualSettings
				}

				res.json({
					success: true,
					message: shouldRestart
						? 'Configuration saved. Restart required to apply changes.'
						: 'Configuration updated successfully',
					data: settings,
					shouldRestart,
				})
			} catch (error) {
				runtime.setRestarting(false)
				logger.error(error)
				res.json({ success: false, message: getErrorMessage(error) })
			}
		},
	)

	// restart gateway
	app.post(
		'/api/restart',
		apisLimiter,
		isAuthenticated,
		async function (req, res) {
			try {
				if (runtime.isRestarting()) {
					throw Error(
						'Gateway is already restarting, wait a moment before doing another request',
					)
				}

				const settings = jsonStore.get(store.settings)

				runtime.setRestarting(true)

				if (runtime.getDebugManager().isSessionActive()) {
					await runtime.getDebugManager().cancelSession()
				}

				// Close gateway and restart. Preserve the historical TypeError
				// when no gateway is attached.
				await runtime.requireGateway('close').close()
				await runtime.destroyPlugins()
				if (settings.gateway) {
					runtime.setupLogging({ gateway: settings.gateway })
				}
				await runtime.startGateway(settings)
				// Resolved AFTER `startGateway()` reassigns the gateway - reusing
				// an earlier local here would observe the just-closed gateway
				// instead of the new one.
				runtime
					.getBackupManager()
					.init(runtime.requireGateway('zwave').zwave, backupManagerOwner)

				// Restart Zniffer if enabled
				const oldZniffer = runtime.getZniffer()
				if (oldZniffer) {
					await oldZniffer.close()
				}
				runtime.startZniffer(settings.zniffer)

				res.json({
					success: true,
					message: 'Gateway restarted successfully',
				})
			} catch (error) {
				runtime.setRestarting(false)
				logger.error(error)
				res.json({ success: false, message: getErrorMessage(error) })
			}
		},
	)

	// update settings
	app.post(
		'/api/statistics',
		apisLimiter,
		isAuthenticated,
		async function (req, res) {
			try {
				if (runtime.isRestarting()) {
					throw Error(
						'Gateway is restarting, wait a moment before doing another request',
					)
				}
				// Reject changes when the statistics opt-in belongs to the managing application
				if (
					getExternallyManagedPaths().includes(
						'zwave.enableStatistics',
					)
				) {
					throw Error('Statistics are managed externally')
				}
				const { enableStatistics } = req.body

				const settings: PersistedSettings =
					jsonStore.get(store.settings) || {}

				if (!settings.zwave) {
					settings.zwave = {}
				}

				settings.zwave.enableStatistics = enableStatistics
				settings.zwave.disclaimerVersion = 1

				await jsonStore.put(store.settings, settings)

				const gw = runtime.getGateway()
				if (gw && gw.zwave) {
					if (enableStatistics) {
						gw.zwave.enableStatistics()
					} else {
						gw.zwave.disableStatistics()
					}
				}

				res.json({
					success: true,
					enabled: enableStatistics,
					message: 'Statistics configuration updated successfully',
				})
			} catch (error) {
				logger.error(error)
				res.json({ success: false, message: getErrorMessage(error) })
			}
		},
	)

	// update versions
	app.post(
		'/api/versions',
		apisLimiter,
		isAuthenticated,
		async function (req, res) {
			try {
				const { disableChangelog } = req.body
				const settings: PersistedSettings =
					jsonStore.get(store.settings) || {}

				if (!settings.gateway) {
					settings.gateway = {
						type: GatewayType.NAMED,
					}
					settings.gateway.versions = {}
				}

				// update versions to actual ones
				settings.gateway.versions = {
					app: utils.pkgJson.version, // don't use getVersion here as it may include commit sha
					driver: libVersion,
					server: serverVersion,
				}

				settings.gateway.disableChangelog = disableChangelog

				await jsonStore.put(store.settings, settings)

				res.json({
					success: true,
					message: 'Versions updated successfully',
				})
			} catch (error) {
				logger.error(error)
				res.json({ success: false, message: getErrorMessage(error) })
			}
		},
	)
}
