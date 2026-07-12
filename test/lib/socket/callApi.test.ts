/**
 * Characterizes `callApi()`, the single dispatcher every ZWAVE_API/MQTT/HASS-callable method
 * routes through.
 */
import { describe, it, expect, beforeAll, vi } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { DriverMode, type Driver } from 'zwave-js'
import type ZWaveClientType from '#api/lib/ZwaveClient.ts'
import { useSocketHarness } from './harness.ts'
import { getTestStoreDir } from '../shared/env.ts'
import { createFakeGateway } from './fakes.ts'

// Populated in beforeAll, after useSocketHarness() has isolated STORE_DIR, so the dynamic
// import below can't evaluate ZwaveClient.ts against the wrong store dir
let ZWaveClient: typeof ZWaveClientType

describe('Socket contract: callApi()', () => {
	const getHarness = useSocketHarness()

	beforeAll(async () => {
		;({ default: ZWaveClient } = await import('#api/lib/ZwaveClient.ts'))
	})

	// The constructor only touches jsonStore, so this is safe without a real driver or serial port
	async function realZwave(): Promise<ZWaveClientType> {
		const harness = await getHarness({
			gateway: createFakeGateway({ zwave: undefined }),
		})
		return new ZWaveClient({}, harness.io)
	}

	function callApiAtRuntime(
		zwave: ZWaveClientType,
		api: unknown,
		...args: unknown[]
	): Promise<{
		success: boolean
		message: string
		args: unknown[]
		result?: unknown
	}> {
		const callApi = zwave.callApi.bind(zwave)
		return Reflect.apply(callApi, undefined, [api, ...args])
	}

	describe('callApi() dispatch', () => {
		it('success: calls a real allowed method and returns its result, message, and echoed args', async () => {
			const zwave = await realZwave()
			await zwave._setScenes([{ sceneid: 1, label: 'Test', values: [] }])
			zwave['_driver'] = {} as unknown as Driver
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
			zwave['_driver'] = {} as unknown as Driver
			zwave.driverReady = true

			const res = await callApiAtRuntime(zwave, 'notARealApiName')

			expect(res).toStrictEqual({
				success: false,
				message: 'Unknown API',
				args: [],
			})
		})

		it('unknown API: also rejects a REAL method name that is simply not in allowedApis', async () => {
			const zwave = await realZwave()
			zwave['_driver'] = {} as unknown as Driver
			zwave.driverReady = true

			// init is a real ZWaveClient method intentionally excluded from allowedApis, so callApi must reject it exactly like a nonexistent name
			const res = await callApiAtRuntime(zwave, 'init')

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
			await zwave._setScenes([])
			zwave['_driver'] = {
				mode: DriverMode.Bootloader,
			} as unknown as Driver
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
			zwave['_driver'] = {} as unknown as Driver
			zwave.driverReady = true

			const res = await zwave.callApi('_removeScene', 999)

			expect(res).toStrictEqual({
				success: false,
				message: 'No scene found with given sceneid',
				args: [999],
			})
		})

		it.each([
			[null, "Cannot read properties of null (reading 'message')"],
			[
				undefined,
				"Cannot read properties of undefined (reading 'message')",
			],
		])(
			'legacy nullish rejection %s: preserves the precise property-access TypeError',
			async (rejection, message) => {
				const zwave = realZwave()
				Reflect.set(zwave, '_driver', {})
				zwave.driverReady = true
				vi.spyOn(zwave, '_getScenes').mockRejectedValueOnce(rejection)

				await expect(zwave.callApi('_getScenes')).rejects.toThrow(message)
			},
		)

		it.each([
			['missing message', {}, undefined],
			['empty message', { message: '' }, ''],
			['zero message', { message: 0 }, 0],
			['false message', { message: false }, false],
		])(
			'falsy error compatibility: %s remains a successful undefined result',
			async (_case, rejection, expectedMessage) => {
				const zwave = realZwave()
				Reflect.set(zwave, '_driver', {})
				zwave.driverReady = true
				vi.spyOn(zwave, '_getScenes').mockRejectedValueOnce(rejection)

				const res = await zwave.callApi('_getScenes')

				expect(res).toStrictEqual({
					success: true,
					message: 'Success zwave api call',
					result: undefined,
					args: [],
				})
				if ('message' in rejection) {
					expect(rejection.message).toBe(expectedMessage)
				}
			},
		)

		it('legacy Symbol error messages still fail during string interpolation', async () => {
			const zwave = realZwave()
			Reflect.set(zwave, '_driver', {})
			zwave.driverReady = true
			vi.spyOn(zwave, '_getScenes').mockRejectedValueOnce({
				message: Symbol('failure'),
			})

			await expect(zwave.callApi('_getScenes')).rejects.toThrow(
				'Cannot convert a Symbol value to a string',
			)
		})

		it('omitted result: a successful call whose method returns undefined has result:undefined', async () => {
			const zwave = await realZwave()
			zwave['_driver'] = {
				controller: {
					nodes: {
						get: () => ({
							id: 5,
							manuallyIdleNotificationValue: () => {},
						}),
					},
				},
			} as unknown as Driver
			zwave.driverReady = true

			const res = await zwave.callApi('manuallyIdleNotificationValue', {
				nodeId: 5,
			} as Parameters<
				ZWaveClientType['manuallyIdleNotificationValue']
			>[0])

			expect(res.success).toBe(true)
			expect(res.message).toBe('Success zwave api call')
			if (!('result' in res))
				throw new Error('Expected successful API result')
			expect(res.result).toBeUndefined()
			// A present-but-undefined key and an absent key both read back as undefined above
			expect('result' in res).toBe(true)
			expect(res.args).toEqual([{ nodeId: 5 }])
		})

		it('absent result: the `result` key does not exist at all on the error path, contrast with the present-but-undefined success case above', async () => {
			const zwave = await realZwave()
			zwave['_driver'] = {} as unknown as Driver
			zwave.driverReady = true

			const res = await callApiAtRuntime(zwave, 'notARealApiName')

			expect(res.success).toBe(false)
			expect('result' in res).toBe(false)
		})

		it('multi-arg dispatch: calls the real, allowed setNodeName(nodeid, name) method with 2 real args, in order, and returns its real boolean result', async () => {
			const zwave = await realZwave()
			zwave.driverReady = true
			// setNodeName only reads/writes .name on the node
			const zwaveNode = { name: undefined as string | undefined }
			zwave['_driver'] = {
				controller: { nodes: { get: () => zwaveNode } },
			} as unknown as Driver
			zwave.nodes.set(7, {
				id: 7,
				ready: false,
				available: true,
				failed: false,
				inited: false,
				eventsQueue: [],
			})
			// storeNodes is only populated by connect(), never called here, so it needs seeding directly
			zwave['storeNodes'] = {}
			// driverInfo.name stays unset, so updateStoreNodes() no-ops; the on-disk write is
			// covered separately by the disk-persistence test below

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
			await zwave._setScenes([{ sceneid: 1, label: 'A', values: [] }])
			zwave['_driver'] = {} as unknown as Driver
			zwave.driverReady = true

			const res = await zwave.callApi('_sceneGetValues', 1)

			expect(res.args).toEqual([1])
		})

		it('argument echo: `args` is echoed back even on the error path (unknown API)', async () => {
			const zwave = await realZwave()
			zwave['_driver'] = {} as unknown as Driver
			zwave.driverReady = true

			const res = await callApiAtRuntime(
				zwave,
				'notARealApiName',
				'a',
				'b',
				3,
			)

			expect(res.args).toEqual(['a', 'b', 3])
		})

		it('argument echo: `args` is echoed back even on the error path (disconnected)', async () => {
			const zwave = await realZwave()

			const res = await callApiAtRuntime(zwave, '_getScenes', 'unused')

			expect(res.args).toEqual(['unused'])
		})
	})

	// Proves a real allowed-API dispatch persists through updateStoreNodes()'s unconditional jsonStore.put(), not just the in-memory node mutation the dispatch test above checks
	describe('callApi() real disk persistence', () => {
		it('setNodeName persists the new name to nodes.json via a real jsonStore.put() write', async () => {
			const isolatedNodesFile = path.join(getTestStoreDir(), 'nodes.json')

			const zwave = await realZwave()
			zwave.driverReady = true
			zwave['driverInfo'] = { name: 'ISOLATIONCHECK' }
			zwave['_driver'] = {
				controller: { nodes: { get: () => ({ name: undefined }) } },
			} as unknown as Driver
			zwave.nodes.set(9, {
				id: 9,
				ready: false,
				available: true,
				failed: false,
				inited: false,
				eventsQueue: [],
			})
			zwave['storeNodes'] = {}

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
