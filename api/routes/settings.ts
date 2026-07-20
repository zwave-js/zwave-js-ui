import type express from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import { libVersion } from 'zwave-js'
import { serverVersion } from '@zwave-js/server'
import { getAllNamedScaleGroups, getAllSensors } from '@zwave-js/core'
import type { Driver } from 'zwave-js'
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
import debugManager from '../lib/DebugManager.ts'
import type { AppRuntime } from '../runtime/AppRuntime.ts'
import { isAuthenticated } from './auth.ts'

const logger = loggers.module('App')

// ZwaveConfig has no index signature
function getZwaveConfigValue(
	config: utils.DeepPartial<ZwaveConfig> | undefined,
	key: string,
): unknown {
	return (config as Record<string, unknown> | undefined)?.[key]
}

export interface SettingsRoutesDeps {
	apisLimiter: RateLimitRequestHandler
	enumerateSerialPorts: typeof Driver.enumerateSerialPorts
}

export function registerSettingsRoutes(
	app: express.Express,
	runtime: AppRuntime,
	{ apisLimiter, enumerateSerialPorts }: SettingsRoutesDeps,
): void {
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
		managedExternally.push(...getExternallyManagedPaths())

		const data = {
			success: true,
			settings,
			devices: runtime.gateway?.zwave?.devices ?? {},
			scales: scales,
			sslDisabled: sslDisabled(),
			managedExternally,
			tz: process.env.TZ,
			locale: process.env.LOCALE,
			deprecationWarning: process.env.TAG_NAME === 'zwavejs2mqtt',
		}

		res.json(data)
	})

	app.get(
		'/api/serial-ports',
		apisLimiter,
		isAuthenticated,
		async function (req, res) {
			let serial_ports: string[] = []

			if (process.platform !== 'sunos' && !process.env.ZWAVE_PORT) {
				try {
					serial_ports = await enumerateSerialPorts({
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

	app.post(
		'/api/settings',
		apisLimiter,
		isAuthenticated,
		async function (req, res) {
			try {
				runtime.assertNotRestarting()
				let settings = req.body

				let shouldRestart = false
				let shouldRestartGw = false
				let shouldRestartZniffer = false
				let canUpdateZwaveOptions = false

				const actualSettings = jsonStore.get(store.settings)

				// TODO: validate settings using class-validator
				if (settings && Object.keys(settings).length > 0) {
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

					if (
						!utils.deepEqual(actualSettings.zwave, settings.zwave)
					) {
						// These driver options apply without a restart
						const editableZWaveSettings = [
							'disableOptimisticValueUpdate',
							'scales',
							'logEnabled',
							'logLevel',
							'logToFile',
							'maxFiles',
							'nodeFilter',
						]

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
							hasDriver: !!runtime.gateway?.zwave?.driver,
						})

						const onlyEditableChanged = changedZwaveKeys.every(
							(key) => editableZWaveSettings.includes(key),
						)

						logger.log(
							'debug',
							'Checking if can update without restart: %o',
							{
								onlyEditableChanged,
								changedKeysLength: changedZwaveKeys.length,
								hasDriver: !!runtime.gateway?.zwave?.driver,
							},
						)

						if (
							onlyEditableChanged &&
							changedZwaveKeys.length > 0 &&
							runtime.gateway?.zwave?.driver
						) {
							canUpdateZwaveOptions = true
							logger.info(
								'Z-Wave settings can be updated without restart',
							)
						} else {
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

					shouldRestartZniffer = !utils.deepEqual(
						actualSettings.zniffer,
						settings.zniffer,
					)
					if (shouldRestartZniffer) {
						shouldRestart = true
					}

					await jsonStore.put(store.settings, settings)

					// Resolve after persistence to avoid a stale gateway
					const gwForDriverUpdate = runtime.gateway
					if (
						canUpdateZwaveOptions &&
						gwForDriverUpdate?.zwave?.driver
					) {
						try {
							const editableOptions: any = {}

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

							// Scales key maps to preferences.scales
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
							shouldRestart = true
							shouldRestartGw = true
						}
					}
				} else {
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
				logger.error(error)
				res.json({ success: false, message: getErrorMessage(error) })
			}
		},
	)

	app.post(
		'/api/restart',
		apisLimiter,
		isAuthenticated,
		async function (req, res) {
			try {
				runtime.assertNotRestarting()

				const settings = jsonStore.get(store.settings)

				runtime.setRestarting(true)

				if (debugManager.isSessionActive()) {
					await debugManager.cancelSession()
					runtime.setOwnsDebugSession(false)
				}

				await runtime.ensureGateway().close()
				await runtime.destroyPlugins()
				if (settings.gateway) {
					runtime.setupLogging({ gateway: settings.gateway })
				}
				await runtime.startGateway(settings)

				const oldZniffer = runtime.zniffer
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

	app.post(
		'/api/statistics',
		apisLimiter,
		isAuthenticated,
		async function (req, res) {
			try {
				runtime.assertNotRestarting()
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

				const gw = runtime.gateway
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

				settings.gateway.versions = {
					app: utils.pkgJson.version, // Skips getVersion() since it may include a commit sha
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
