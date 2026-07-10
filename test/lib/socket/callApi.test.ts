/**
 * Characterizes: `ZwaveClient.allowedApis` (`api/lib/ZwaveClient.ts:182-293`,
 * the exhaustive contract of methods callable through `ZWAVE_API`/MQTT/HASS)
 * and `ZwaveClient.callApi()` (`api/lib/ZwaveClient.ts:6032-6067`, the single
 * dispatcher that all three inbound APIs route through).
 *
 * A hard-coded, independent copy of the full 110-entry `allowedApis` list is
 * compared against the real export via `toStrictEqual` - if a method is
 * added/removed/renamed in production, this test fails and the list here
 * must be updated deliberately (not derived from the production constant).
 *
 * Several contract entries are prefixed with `_` (`_createScene`,
 * `_removeScene`, `_getScenes`, `_deleteGroup`, ...) - despite the
 * convention that a leading underscore signals "private", these are very
 * much PUBLIC CONTRACT: they're reachable from any client over
 * `ZWAVE_API`/MQTT/HASS as long as they appear in `allowedApis`. The prefix
 * only means "not part of the public TypeScript surface for in-process
 * callers", not "internal".
 *
 * A REAL `ZWaveClient` instance is used throughout (safe to construct
 * directly - see `outboundProducers.test.ts`'s doc comment for why), with
 * `driverReady`/`_driver`/`.scenes` poked directly (all real, public or
 * underscore-public fields) to reach each `callApi` branch without a real
 * driver graph.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { DriverMode } from 'zwave-js'
import ZWaveClient, { allowedApis } from '../../../api/lib/ZwaveClient.ts'
import { createSocketHarness, type SocketHarness } from './harness.ts'

/**
 * Independent, hard-coded copy of `api/lib/ZwaveClient.ts`'s exported
 * `allowedApis` list (lines 182-293) - NOT derived from the production
 * constant. Compared against the real export below.
 */
const EXPECTED_ALLOWED_APIS = [
	'setNodeName',
	'setNodeLocation',
	'setNodeDefaultSetValueOptions',
	'_createScene',
	'_removeScene',
	'_setScenes',
	'_getScenes',
	'_sceneGetValues',
	'_addSceneValue',
	'_removeSceneValue',
	'_activateScene',
	'_createGroup',
	'_updateGroup',
	'_deleteGroup',
	'_getGroups',
	'refreshNeighbors',
	'getNodeNeighbors',
	'discoverNodeNeighbors',
	'getAssociations',
	'checkAssociation',
	'addAssociations',
	'removeAssociations',
	'removeAllAssociations',
	'removeNodeFromAllAssociations',
	'getNodes',
	'getInfo',
	'refreshValues',
	'refreshCCValues',
	'pollValue',
	'setPowerlevel',
	'setRFRegion',
	'setMaxLRPowerLevel',
	'updateControllerNodeProps',
	'startInclusion',
	'startExclusion',
	'stopInclusion',
	'stopExclusion',
	'replaceFailedNode',
	'hardReset',
	'softReset',
	'rebuildNodeRoutes',
	'getPriorityRoute',
	'setPriorityRoute',
	'assignReturnRoutes',
	'getPriorityReturnRoute',
	'getPrioritySUCReturnRoute',
	'getCustomReturnRoute',
	'getCustomSUCReturnRoute',
	'assignPriorityReturnRoute',
	'assignPrioritySUCReturnRoute',
	'assignCustomReturnRoutes',
	'assignCustomSUCReturnRoutes',
	'deleteReturnRoutes',
	'deleteSUCReturnRoutes',
	'removePriorityRoute',
	'beginRebuildingRoutes',
	'stopRebuildingRoutes',
	'isFailedNode',
	'removeFailedNode',
	'refreshInfo',
	'updateFirmware',
	'firmwareUpdateOTW',
	'abortFirmwareUpdate',
	'dumpNode',
	'getAvailableFirmwareUpdates',
	'getAllAvailableFirmwareUpdates',
	'checkAllNodesFirmwareUpdates',
	'dismissFirmwareUpdate',
	'getNodeFirmwareUpdates',
	'firmwareUpdateOTA',
	'sendCommand',
	'writeValue',
	'writeBroadcast',
	'writeMulticast',
	'driverFunction',
	'checkForConfigUpdates',
	'installConfigUpdate',
	'shutdownZwaveAPI',
	'startLearnMode',
	'stopLearnMode',
	'pingNode',
	'restart',
	'grantSecurityClasses',
	'validateDSK',
	'abortInclusion',
	'backupNVMRaw',
	'restoreNVM',
	'getProvisioningEntries',
	'getProvisioningEntry',
	'unprovisionSmartStartNode',
	'provisionSmartStartNode',
	'parseQRCodeString',
	'checkLifelineHealth',
	'abortHealthCheck',
	'checkRouteHealth',
	'checkLinkReliability',
	'abortLinkReliabilityCheck',
	'syncNodeDateAndTime',
	'manuallyIdleNotificationValue',
	'getSchedules',
	'cancelGetSchedule',
	'setSchedule',
	'setEnabledSchedule',
	'getConfigurationTemplates',
	'createConfigurationTemplate',
	'updateConfigurationTemplate',
	'deleteConfigurationTemplate',
	'applyConfigurationTemplate',
	'importConfigurationTemplates',
	'getDeviceConfigurationParams',
] as const

describe('Socket contract: callApi()', () => {
	let harness: SocketHarness

	beforeAll(async () => {
		harness = await createSocketHarness()
	})

	afterAll(async () => {
		await harness.close()
	})

	function realZwave(): ZWaveClient {
		return new ZWaveClient({} as any, harness.io)
	}

	describe('allowedApis contract', () => {
		it('has exactly 110 entries', () => {
			expect(EXPECTED_ALLOWED_APIS).toHaveLength(110)
			expect(allowedApis).toHaveLength(110)
		})

		it('matches the full, exact, hard-coded independent contract (order included)', () => {
			expect(allowedApis).toStrictEqual(EXPECTED_ALLOWED_APIS)
		})

		it('includes several underscore-prefixed methods that ARE public contract, not private', () => {
			const underscoreApis = allowedApis.filter((a) => a.startsWith('_'))
			expect(underscoreApis).toStrictEqual([
				'_createScene',
				'_removeScene',
				'_setScenes',
				'_getScenes',
				'_sceneGetValues',
				'_addSceneValue',
				'_removeSceneValue',
				'_activateScene',
				'_createGroup',
				'_updateGroup',
				'_deleteGroup',
				'_getGroups',
			])
		})
	})

	describe('callApi() dispatch', () => {
		it('success: calls a real allowed method and returns its result, message, and echoed args', async () => {
			const zwave = realZwave()
			zwave.scenes = [{ sceneid: 1, label: 'Test', values: [] }]
			;(zwave as any)._driver = {}
			zwave.driverReady = true

			const res = await zwave.callApi('_getScenes')

			expect(res).toStrictEqual({
				success: true,
				message: 'Success zwave api call',
				result: [{ sceneid: 1, label: 'Test', values: [] }],
				args: [],
			})
		})

		it('unknown API: reports success:false with "Unknown API" for a name not in allowedApis', async () => {
			const zwave = realZwave()
			;(zwave as any)._driver = {}
			zwave.driverReady = true

			const res = await zwave.callApi('notARealApiName' as any)

			expect(res).toStrictEqual({
				success: false,
				message: 'Unknown API',
				args: [],
			})
		})

		it('unknown API: also rejects a REAL method name that is simply not in allowedApis', async () => {
			const zwave = realZwave()
			;(zwave as any)._driver = {}
			zwave.driverReady = true

			// `init` is a real, existing method on ZWaveClient, but it is
			// intentionally NOT part of `allowedApis` - `callApi` must
			// reject it exactly like a nonexistent name.
			const res = await zwave.callApi('init' as any)

			expect(res).toStrictEqual({
				success: false,
				message: 'Unknown API',
				args: [],
			})
		})

		it('disconnected: reports "Z-Wave client not connected" when neither driverReady nor bootloader mode', async () => {
			const zwave = realZwave()
			// fresh client: driverReady is false, driver is undefined

			const res = await zwave.callApi('_getScenes')

			expect(res).toStrictEqual({
				success: false,
				message: 'Z-Wave client not connected',
				args: [],
			})
		})

		it('bootloader: allows the call when driver.mode is Bootloader even though driverReady is false', async () => {
			const zwave = realZwave()
			zwave.scenes = []
			;(zwave as any)._driver = { mode: DriverMode.Bootloader }
			// driverReady stays false (never set) - only bootloader mode
			// permits the call.

			const res = await zwave.callApi('_getScenes')

			expect(res).toStrictEqual({
				success: true,
				message: 'Success zwave api call',
				result: [],
				args: [],
			})
		})

		it('thrown error: catches a real thrown Error and surfaces its .message', async () => {
			const zwave = realZwave()
			zwave.scenes = []
			;(zwave as any)._driver = {}
			zwave.driverReady = true

			const res = await zwave.callApi('_removeScene', 999)

			expect(res).toStrictEqual({
				success: false,
				message: 'No scene found with given sceneid',
				args: [999],
			})
		})

		it('omitted result: a successful call whose method returns undefined has result:undefined (ZwaveClient.ts:2143-2154)', async () => {
			const zwave = realZwave()
			;(zwave as any)._driver = {
				controller: {
					nodes: {
						get: () => ({
							id: 5,
							manuallyIdleNotificationValue: () => {},
						}),
					},
				},
			}
			zwave.driverReady = true

			const res = await zwave.callApi('manuallyIdleNotificationValue', {
				nodeId: 5,
			} as any)

			expect(res.success).toBe(true)
			expect(res.message).toBe('Success zwave api call')
			expect(res.result).toBeUndefined()
			expect(res.args).toEqual([{ nodeId: 5 }])
		})

		it('argument echo: `args` is set to the exact array passed in, in order, for a multi-arg call', async () => {
			const zwave = realZwave()
			zwave.scenes = [{ sceneid: 1, label: 'A', values: [] }]
			;(zwave as any)._driver = {}
			zwave.driverReady = true

			const res = await zwave.callApi('_sceneGetValues', 1)

			expect(res.args).toEqual([1])
		})

		it('argument echo: `args` is echoed back even on the error path (unknown API)', async () => {
			const zwave = realZwave()
			;(zwave as any)._driver = {}
			zwave.driverReady = true

			const res = await zwave.callApi(
				'notARealApiName' as any,
				'a',
				'b',
				3,
			)

			expect(res.args).toEqual(['a', 'b', 3])
		})

		it('argument echo: `args` is echoed back even on the error path (disconnected)', async () => {
			const zwave = realZwave()

			const res = await zwave.callApi('_getScenes' as any, 'unused')

			expect(res.args).toEqual(['unused'])
		})
	})
})
