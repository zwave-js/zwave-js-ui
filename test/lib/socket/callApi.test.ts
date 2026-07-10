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
 *
 * ### Store isolation (HIGH regression)
 *
 * `ZwaveClient.ts` (and, transitively, `jsonStore.ts`) reads `storeDir`
 * from `api/config/app.ts` at MODULE-EVALUATION time, not lazily. A plain
 * top-level `import ZWaveClient from '../../../api/lib/ZwaveClient.ts'`
 * is hoisted and evaluated before ANY of this file's own code runs -
 * including `beforeAll`, and therefore before `createSocketHarness()` (via
 * `./env.ts`'s `ensureTestEnv()`) ever gets a chance to point
 * `process.env.STORE_DIR` at this file's throwaway directory. If that
 * import ran first, `api/config/app.ts`'s `storeDir` constant would be
 * permanently fixed (for this file's whole module graph) to whatever
 * `process.env.STORE_DIR` happened to be at that moment - typically unset,
 * which defaults to the REAL repository `store/` directory
 * (`api/config/app.ts:11`). Every real `jsonStore.put()` write this file
 * triggers (e.g. `_deleteGroup`, `setNodeName`) would then land on disk in
 * the actual repo, not the isolated harness directory - silently
 * corrupting real application data (`store/groups.json`,
 * `store/nodes.json`, ...) every time this suite runs. This was
 * reproduced directly in this worktree: running the suite before this fix
 * measurably changed `store/groups.json`'s mtime/content.
 *
 * The fix: only `import type` ZWaveClient here (type-only imports are
 * fully erased at compile time - zero runtime side effect, so they can
 * never race the isolation setup). The actual runtime class is loaded via
 * a dynamic `import()` inside `beforeAll`, AFTER `createSocketHarness()`
 * has already called `ensureTestEnv()` (via `loadAppModule()`) - so
 * `api/config/app.ts` (and `jsonStore.ts`) are guaranteed to first
 * evaluate with the isolated `STORE_DIR` already in place, exactly like
 * `api/app.ts` itself does. See `store-write isolation regression` below
 * for a regression that proves a real write lands only in the harness's
 * directory. `outboundProducers.test.ts` applies the identical fix for
 * `ZWaveClient`/`ZnifferManager`.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DriverMode } from 'zwave-js'
import type ZWaveClientType from '../../../api/lib/ZwaveClient.ts'
import { createSocketHarness, type SocketHarness } from './harness.ts'
import { getTestStoreDir } from './env.ts'

const repoRoot = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	'../../..',
)

// Populated in `beforeAll`, AFTER the harness has isolated `STORE_DIR` -
// see the file doc comment above for why this can't be a plain top-level
// `import`.
let ZWaveClient: typeof ZWaveClientType
let allowedApis: readonly string[]

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
		// Isolate `STORE_DIR` FIRST (via the harness), THEN dynamically
		// import the real, store-dependent `ZwaveClient.ts` module - see
		// the file doc comment's "Store isolation" section for why order
		// matters here.
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
			// `res.result === undefined` alone can't distinguish "the key
			// exists with value undefined" (production's real behavior,
			// per `ZwaveClient.ts:6058-6067`: `toReturn.result = result`
			// unconditionally on the success path) from "the key was never
			// set" - both read back as `undefined` through property
			// access. Prove the key is genuinely PRESENT here, then
			// contrast with the error path below where it's genuinely
			// ABSENT.
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
			// A minimal real-shaped `ZWaveNode` stub: `setNodeName` only
			// reads/writes `.name` on it.
			const zwaveNode: any = { name: undefined }
			;(zwave as any)._driver = {
				controller: { nodes: { get: () => zwaveNode } },
			}
			;(zwave as any)._nodes.set(7, { id: 7 } as any)
			// `storeNodes` is only ever populated by `connect()` (never
			// called here) - a real client that never connected has it
			// `undefined`, so `setNodeName` needs it seeded directly.
			;(zwave as any).storeNodes = {}
			// `driverInfo.name` (read by the real `homeHex` getter) stays
			// unset here on purpose: `updateStoreNodes()` warns and no-ops
			// without it (ZwaveClient.ts:2799-2802), so this test stays
			// focused on dispatch/argument-order/result semantics - see
			// the dedicated `store-write isolation regression` below for
			// the real on-disk write.

			const res = await zwave.callApi('setNodeName', 7, 'Living Room')

			expect(res).toStrictEqual({
				success: true,
				message: 'Success zwave api call',
				result: true,
				args: [7, 'Living Room'],
			})
			// The real method's actual side effect happened too - this
			// isn't just an echoed-back literal.
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

	/**
	 * HIGH regression (see file doc comment): proves a REAL disk write
	 * triggered through `callApi()` lands in THIS file's isolated harness
	 * store directory, and never touches the real repository `store/`
	 * directory - the exact failure mode the import-order fix above
	 * prevents. `setNodeName` is used because (a) it's real allowed-API
	 * dispatch through `callApi`, matching this file's whole purpose, and
	 * (b) `updateStoreNodes()` performs a real, unconditional
	 * `jsonStore.put()` write once `homeHex` is set (ZwaveClient.ts:2797-
	 * 2828), unlike `_deleteGroup`'s group-store write which was the
	 * originally-reported symptom.
	 */
	describe('store-write isolation regression', () => {
		it("a real callApi()-triggered jsonStore write lands ONLY in this file's isolated STORE_DIR, never the repo's store/ directory", async () => {
			const isolatedNodesFile = path.join(getTestStoreDir(), 'nodes.json')
			const repoNodesFile = path.join(repoRoot, 'store', 'nodes.json')
			const repoSnapshotBefore = existsSync(repoNodesFile)
				? readFileSync(repoNodesFile, 'utf8')
				: undefined

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

			// The write really happened, and really landed in the
			// isolated harness directory (not just "no error was
			// thrown").
			expect(existsSync(isolatedNodesFile)).toBe(true)
			const persisted = JSON.parse(
				readFileSync(isolatedNodesFile, 'utf8'),
			)
			expect(persisted.ISOLATIONCHECK['9'].name).toBe('Isolation Probe')

			// The real repo store/ directory is byte-for-byte unchanged -
			// proving the write did NOT ALSO (or instead) land there.
			const repoSnapshotAfter = existsSync(repoNodesFile)
				? readFileSync(repoNodesFile, 'utf8')
				: undefined
			expect(repoSnapshotAfter).toBe(repoSnapshotBefore)
			if (repoSnapshotAfter !== undefined) {
				expect(repoSnapshotAfter).not.toContain('ISOLATIONCHECK')
			}
		})
	})
})
