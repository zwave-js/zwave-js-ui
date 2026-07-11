import type express from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import store from '../config/store.ts'
import jsonStore from '../lib/jsonStore.ts'
import * as loggers from '../lib/logger.ts'
import * as utils from '../lib/utils.ts'
import {
	getImportedNodeLocation,
	normalizeImportedNodesConfig,
} from '../lib/importConfig.ts'
import { getErrorMessage } from '../lib/errors.ts'
import type { AppRuntime } from '../runtime/AppRuntime.ts'
import { isAuthenticated } from './auth.ts'

const logger = loggers.module('App')

export interface ImportExportRoutesDeps {
	apisLimiter: RateLimitRequestHandler
}

export function registerImportExportRoutes(
	app: express.Express,
	runtime: AppRuntime,
	{ apisLimiter }: ImportExportRoutesDeps,
): void {
	// get config
	app.get(
		'/api/exportConfig',
		apisLimiter,
		isAuthenticated,
		function (req, res) {
			return res.json({
				success: true,
				data: jsonStore.get(store.nodes),
				message: 'Successfully exported nodes JSON configuration',
			})
		},
	)

	// import config
	app.post(
		'/api/importConfig',
		apisLimiter,
		isAuthenticated,
		async function (req, res) {
			try {
				// Preserved quirk: a missing gateway reports the historical
				// native-TypeError message.
				const gw = runtime.requireGateway('zwave')
				if (!gw.zwave) throw Error('Z-Wave client not inited')

				const { nodes, selectedHomeId, skippedHomeIds } =
					normalizeImportedNodesConfig(
						req.body.data,
						gw.zwave.homeHex,
						{
							homeId:
								typeof req.body.homeId === 'string'
									? req.body.homeId
									: undefined,
							mergeAll: req.body.mergeAll === true,
						},
					)

				if (skippedHomeIds.length > 0) {
					logger.warn(
						`Import: skipped nodes for home id(s) ${skippedHomeIds.join(
							', ',
						)}` +
							(selectedHomeId
								? `, imported ${selectedHomeId} (current controller)`
								: ', none matched the current controller'),
					)
				}

				if (!selectedHomeId && skippedHomeIds.length > 0) {
					return res.json({
						success: false,
						message: `Import skipped: the backup contains nodes for home ids ${skippedHomeIds.join(
							', ',
						)}, none of which match the connected controller (${
							gw.zwave.homeHex
						}).`,
					})
				}

				for (const nodeId in nodes) {
					const node = nodes[nodeId]
					if (!node || typeof node !== 'object') continue

					if (!utils.isValidNodeIdString(nodeId)) {
						continue
					}

					// All API calls expect nodeId to be a number, so convert it here.
					const nodeIdNumber = Number(nodeId)

					if (utils.hasProperty(node, 'name')) {
						await gw.zwave.callApi(
							'setNodeName',
							nodeIdNumber,
							typeof node.name === 'string' ? node.name : '',
						)
					}

					if (
						utils.hasProperty(node, 'loc') ||
						utils.hasProperty(node, 'location')
					) {
						await gw.zwave.callApi(
							'setNodeLocation',
							nodeIdNumber,
							getImportedNodeLocation(node),
						)
					}

					if (utils.isRecord(node.hassDevices)) {
						await gw.zwave.storeDevices(
							node.hassDevices,
							nodeIdNumber,
							false,
						)
					}
				}

				res.json({
					success: true,
					message: 'Configuration imported successfully',
				})
			} catch (error) {
				logger.error(getErrorMessage(error))
				return res.json({
					success: false,
					message: getErrorMessage(error),
				})
			}
		},
	)
}
