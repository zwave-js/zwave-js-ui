/**
 * Characterizes `ZwaveClient.allowedApis`, the exhaustive ZWAVE_API/MQTT/HASS-callable contract, and `callApi()`, the single dispatcher those APIs route through.
 *
 * Underscore-prefixed entries (`_createScene`, `_getScenes`, ...) are public contract despite looking private - the prefix only hides them from in-process TypeScript callers.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { DriverMode } from 'zwave-js'
import type ZWaveClientType from '#api/lib/ZwaveClient.ts'
import { useSocketHarness } from './harness.ts'
import { getTestStoreDir } from '../shared/env.ts'
import { createFakeGateway } from './fakes.ts'

// Populated in beforeAll, after useSocketHarness()'s own beforeAll has isolated STORE_DIR, so this dynamic import can't evaluate ZwaveClient.ts against the wrong store dir
let ZWaveClient: typeof ZWaveClientType
let allowedApis: readonly string[]

describe('Socket contract: callApi()', () => {
	const getHarness = useSocketHarness()

	beforeAll(async () => {
		;({ default: ZWaveClient, allowedApis } = await import(
			'#api/lib/ZwaveClient.ts'
		))
	})

	// Safe to construct directly since the constructor only touches jsonStore, never a real driver or serial port, unless connect() is called
	async function realZwave(): Promise<ZWaveClientType> {
		const harness = await getHarness({
			gateway: createFakeGateway({ zwave: undefined }),
		})
		return new ZWaveClient({} as any, harness.io)
	}

	describe('allowedApis contract', () => {
		it('has no duplicate entries', () => {
			expect(new Set(allowedApis).size).toBe(allowedApis.length)
		})

		it('every entry names a real function on ZwaveClient.prototype - the exact assumption callApi() dispatch relies on (ZwaveClient.ts:6042-6047)', () => {
			for (const name of allowedApis) {
				expect(typeof (ZWaveClient.prototype as any)[name]).toBe(
					'function',
				)
			}
		})

		it('includes several underscore-prefixed methods that ARE public contract, not private', () => {
			const underscoreApis = allowedApis.filter((a) => a.startsWith('_'))
			expect(underscoreApis.length).toBeGreaterThan(0)
			expect(underscoreApis).toEqual(
				expect.arrayContaining(['_getScenes', '_createScene']),
			)
		})
	})

	describe('callApi() dispatch', () => {
		it('success: calls a real allowed method and returns its result, message, and echoed args', async () => {
			const zwave = await realZwave()
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
			const zwave = await realZwave()
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
			const zwave = await realZwave()
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
			const zwave = await realZwave()
			// Fresh client: driverReady stays false, driver stays undefined

			const res = await zwave.callApi('_getScenes')

			expect(res).toStrictEqual({
				success: false,
				message: 'Z-Wave client not connected',
				args: [],
			})
		})

		it('bootloader: allows the call when driver.mode is Bootloader even though driverReady is false', async () => {
			const zwave = await realZwave()
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
			const zwave = await realZwave()
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
			const zwave = await realZwave()
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
			const zwave = await realZwave()
			;(zwave as any)._driver = {}
			zwave.driverReady = true

			const res = await zwave.callApi('notARealApiName' as any)

			expect(res.success).toBe(false)
			expect('result' in res).toBe(false)
		})

		it('multi-arg dispatch: calls the real, allowed setNodeName(nodeid, name) method with 2 real args, in order, and returns its real boolean result (ZwaveClient.ts:2833-2857)', async () => {
			const zwave = await realZwave()
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
			const zwave = await realZwave()
			zwave.scenes = [{ sceneid: 1, label: 'A', values: [] }]
			;(zwave as any)._driver = {}
			zwave.driverReady = true

			const res = await zwave.callApi('_sceneGetValues', 1)

			expect(res.args).toEqual([1])
		})

		it('argument echo: `args` is echoed back even on the error path (unknown API)', async () => {
			const zwave = await realZwave()
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
			const zwave = await realZwave()

			const res = await zwave.callApi('_getScenes' as any, 'unused')

			expect(res.args).toEqual(['unused'])
		})
	})

	// Proves a real allowed-API dispatch persists through updateStoreNodes()'s unconditional jsonStore.put(), not just the in-memory node mutation the dispatch test above checks
	describe('callApi() real disk persistence', () => {
		it('setNodeName persists the new name to nodes.json via a real jsonStore.put() write', async () => {
			const isolatedNodesFile = path.join(getTestStoreDir(), 'nodes.json')

			const zwave = await realZwave()
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
