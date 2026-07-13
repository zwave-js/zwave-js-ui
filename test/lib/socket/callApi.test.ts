/**
 * Characterizes `ZwaveClient.allowedApis`, the exhaustive ZWAVE_API/MQTT/HASS-callable contract, and `callApi()`, the single dispatcher those APIs route through.
 *
 * Underscore-prefixed entries (`_createScene`, `_getScenes`, ...) are public contract despite looking private - the prefix only hides them from in-process TypeScript callers.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { DriverMode } from 'zwave-js'
import type ZWaveClientType from '../../../api/lib/ZwaveClient.ts'
import { createSocketHarness, type SocketHarness } from './harness.ts'
import { getTestStoreDir } from './env.ts'

// Populated in beforeAll, after the harness has isolated STORE_DIR, so a top-level import can't evaluate ZwaveClient.ts against the wrong store dir
let ZWaveClient: typeof ZWaveClientType
let allowedApis: readonly string[]

// Independent, hard-coded copy of ZwaveClient.ts's exported allowedApis list, not derived from the production constant
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
		;({ default: ZWaveClient, allowedApis } = await import(
			'../../../api/lib/ZwaveClient.ts'
		))
	})

	afterAll(async () => {
		await harness.close()
	})

	function realZwave(): ZWaveClientType {
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

			// init is a real ZWaveClient method intentionally excluded from allowedApis, so callApi must reject it exactly like a nonexistent name
			const res = await zwave.callApi('init' as any)

			expect(res).toStrictEqual({
				success: false,
				message: 'Unknown API',
				args: [],
			})
		})

		it('disconnected: reports "Z-Wave client not connected" when neither driverReady nor bootloader mode', async () => {
			const zwave = realZwave()
			// Fresh client: driverReady stays false, driver stays undefined

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
			// Only bootloader mode permits the call here since driverReady stays false

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
			// res.result === undefined can't distinguish a present key from an absent one since both read back as undefined through property access, so assert 'result' in res instead
			expect('result' in res).toBe(true)
			expect(res.args).toEqual([{ nodeId: 5 }])
		})

		it('absent result: the `result` key does not exist at all on the error path - contrast with the present-but-undefined success case above (ZwaveClient.ts:6058-6067)', async () => {
			const zwave = realZwave()
			;(zwave as any)._driver = {}
			zwave.driverReady = true

			const res = await zwave.callApi('notARealApiName' as any)

			expect(res.success).toBe(false)
			expect('result' in res).toBe(false)
		})

		it('multi-arg dispatch: calls the real, allowed setNodeName(nodeid, name) method with 2 real args, in order, and returns its real boolean result (ZwaveClient.ts:2833-2857)', async () => {
			const zwave = realZwave()
			zwave.driverReady = true
			// setNodeName only reads/writes .name on the node
			const zwaveNode: any = { name: undefined }
			;(zwave as any)._driver = {
				controller: { nodes: { get: () => zwaveNode } },
			}
			;(zwave as any)._nodes.set(7, { id: 7 } as any)
			// storeNodes is only populated by connect(), never called here, so it needs seeding directly
			;(zwave as any).storeNodes = {}
			// driverInfo.name (read by the real homeHex getter) stays unset so updateStoreNodes() no-ops and this test stays focused on dispatch/argument-order/result semantics, not the on-disk write covered by the disk-persistence test below

			const res = await zwave.callApi('setNodeName', 7, 'Living Room')

			expect(res).toStrictEqual({
				success: true,
				message: 'Success zwave api call',
				result: true,
				args: [7, 'Living Room'],
			})
			// Proves the real method's side effect happened, not just an echoed-back literal
			expect(zwaveNode.name).toBe('Living Room')
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

	// Proves a real allowed-API dispatch persists through updateStoreNodes()'s unconditional jsonStore.put(), not just the in-memory node mutation the dispatch test above checks
	describe('callApi() real disk persistence', () => {
		it('setNodeName persists the new name to nodes.json via a real jsonStore.put() write', async () => {
			const isolatedNodesFile = path.join(getTestStoreDir(), 'nodes.json')

			const zwave = realZwave()
			zwave.driverReady = true
			;(zwave as any).driverInfo = { name: 'ISOLATIONCHECK' }
			;(zwave as any)._driver = {
				controller: { nodes: { get: () => ({ name: undefined }) } },
			}
			;(zwave as any)._nodes.set(9, { id: 9 } as any)
			;(zwave as any).storeNodes = {}

			const res = await zwave.callApi('setNodeName', 9, 'Isolation Probe')
			expect(res.success).toBe(true)

			expect(existsSync(isolatedNodesFile)).toBe(true)
			const persisted = JSON.parse(
				readFileSync(isolatedNodesFile, 'utf8'),
			)
			expect(persisted.ISOLATIONCHECK['9'].name).toBe('Isolation Probe')
		})
	})
})
