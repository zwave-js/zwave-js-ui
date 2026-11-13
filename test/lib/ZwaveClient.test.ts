import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import ZwaveClient from '../../api/lib/ZwaveClient.ts'
import jsonStore from '../../api/lib/jsonStore.ts'

// `throttle` only touches `throttledFunctions`, so these tests skip the real
// constructor. It reads the json stores and needs a socket server.
function createClient() {
	const client = Object.create(ZwaveClient.prototype) as ZwaveClient
	client['throttledFunctions'] = new Map()
	return client
}

describe('#ZwaveClient', () => {
	describe('#throttle()', () => {
		let client: ZwaveClient

		beforeEach(() => {
			vi.useFakeTimers({ now: 0 })
			client = createClient()
		})

		afterEach(() => {
			vi.useRealTimers()
		})

		function throttle(fn: () => void, wait = 1000) {
			client['throttle']('key', fn, wait)
		}

		it('runs the first call immediately', () => {
			const fn = vi.fn()
			throttle(fn)
			expect(fn).toHaveBeenCalledTimes(1)
		})

		it('coalesces a burst into a single trailing run with the latest fn', () => {
			const calls: string[] = []
			throttle(() => calls.push('first'))
			vi.advanceTimersByTime(100)
			throttle(() => calls.push('second'))
			vi.advanceTimersByTime(100)
			throttle(() => calls.push('third'))

			expect(calls).to.deep.equal(['first'])

			vi.advanceTimersByTime(1000)
			expect(calls).to.deep.equal(['first', 'third'])
		})

		it('coalesces calls made while a fn slower than wait was running', () => {
			const startedAt: number[] = []
			// `vi.setSystemTime` shifts every pending timer deadline along with
			// the clock, so a slow `fn` here models a clock jump. A blocked
			// event loop instead leaves deadlines in place and fires them late.
			// Both reach the push-back branch and end at the same run times.
			const slowFn = () => {
				startedAt.push(Date.now())
				vi.setSystemTime(Date.now() + 2500)
			}

			throttle(slowFn)
			expect(startedAt).to.deep.equal([0])

			// These three calls land after the slow run returned, inside the
			// window it pushed forward
			throttle(slowFn)
			throttle(slowFn)
			throttle(slowFn)
			expect(startedAt).to.deep.equal([0])

			vi.advanceTimersByTime(1000)
			expect(startedAt).to.deep.equal([0, 3500])
		})

		it('pushes back a trailing run queued 500ms into a 2500ms fn', () => {
			const startedAt: number[] = []
			let reentered = false
			const slowFn = () => {
				const start = Date.now()
				startedAt.push(start)
				if (!reentered) {
					reentered = true
					// A synchronous `fn` blocks the event loop for its whole
					// duration, so only `fn` itself can call in mid-run
					vi.setSystemTime(start + 500)
					throttle(slowFn)
				}
				vi.setSystemTime(start + 2500)
			}

			throttle(slowFn)
			expect(startedAt).to.deep.equal([0])
			expect(Date.now()).to.equal(2500)

			// The call at 500 queued a trailing timer, and the clock jump moved
			// its deadline out along with everything else
			vi.advanceTimersByTime(500)
			expect(startedAt).to.deep.equal([0])

			vi.advanceTimersByTime(500)
			expect(startedAt).to.deep.equal([0, 3500])
		})

		it('delays the trailing run until wait ms after a slow fn returned', () => {
			const startedAt: number[] = []
			let reentered = false
			const slowFn = () => {
				startedAt.push(Date.now())
				vi.setSystemTime(Date.now() + 2500)
				if (!reentered) {
					reentered = true
					throttle(slowFn)
				}
			}

			throttle(slowFn)
			expect(startedAt).to.deep.equal([0])

			// The re-entrant call landed inside the first run, so its trailing
			// timer comes due before the window ends
			vi.advanceTimersByTime(500)
			expect(startedAt).to.deep.equal([0])

			vi.advanceTimersByTime(500)
			expect(startedAt).to.deep.equal([0, 3500])
		})

		it('runs on the leading edge again once wait has passed', () => {
			const fn = vi.fn()
			throttle(fn)
			vi.advanceTimersByTime(1001)
			throttle(fn)
			expect(fn).toHaveBeenCalledTimes(2)
		})

		it('drops a pending trailing run when a later call takes the leading edge', () => {
			const fn = vi.fn()
			throttle(fn)
			vi.setSystemTime(500)
			throttle(fn)
			expect(fn).toHaveBeenCalledTimes(1)

			// The trailing timer is still armed here, and this call runs the
			// same queued `fn` on the leading edge
			vi.setSystemTime(3600)
			throttle(fn)
			expect(fn).toHaveBeenCalledTimes(2)

			// The armed timer must not add a third run
			vi.advanceTimersByTime(5000)
			expect(fn).toHaveBeenCalledTimes(2)
		})

		it('cancels a pending trailing run on clearThrottle', () => {
			const fn = vi.fn()
			throttle(fn)
			vi.setSystemTime(500)
			throttle(fn)

			client['clearThrottle']('key')
			vi.advanceTimersByTime(5000)
			expect(fn).toHaveBeenCalledTimes(1)
		})

		it('logs a throw on the trailing path instead of crashing the process', () => {
			throttle(() => {})
			vi.setSystemTime(500)
			throttle(() => {
				throw new Error('boom')
			})

			expect(() => vi.advanceTimersByTime(1000)).to.not.throw()
		})

		it('stamps the window even when fn throws', () => {
			const boom = () => {
				vi.setSystemTime(Date.now() + 2500)
				throw new Error('boom')
			}
			expect(() => throttle(boom)).to.throw('boom')

			const fn = vi.fn()
			throttle(fn)
			expect(fn).toHaveBeenCalledTimes(0)

			vi.advanceTimersByTime(1000)
			expect(fn).toHaveBeenCalledTimes(1)
		})
	})

	describe('#firmware updates', () => {
		afterEach(() => {
			vi.restoreAllMocks()
		})

		function createFirmwareClient(options?: {
			disableAutomaticFirmwareUpdateChecks?: boolean
			driverNodes?: Map<number, any>
			getAllAvailableFirmwareUpdates?: () => Promise<Map<number, any[]>>
			getAvailableFirmwareUpdates?: (
				nodeId: number,
				opts?: any,
			) => Promise<any[]>
		}) {
			vi.spyOn(jsonStore, 'get').mockReturnValue([] as any)
			const client = new ZwaveClient(
				{
					disableAutomaticFirmwareUpdateChecks:
						options?.disableAutomaticFirmwareUpdateChecks ?? false,
				} as any,
				null as any,
			)
			client['storeNodes'] = {}
			client['driverReady'] = true
			client['_driver'] = {
				controller: {
					ownNodeId: 1,
					nodes: options?.driverNodes ?? new Map(),
					getAllAvailableFirmwareUpdates:
						options?.getAllAvailableFirmwareUpdates ??
						vi.fn().mockResolvedValue(new Map()),
					getAvailableFirmwareUpdates:
						options?.getAvailableFirmwareUpdates ??
						vi.fn().mockResolvedValue([]),
				},
			} as any
			client['emitNodeUpdate'] = vi.fn()
			client['updateStoreNodes'] = vi.fn().mockResolvedValue(undefined)
			client['logNode'] = vi.fn()
			client['emit'] = vi.fn() as any
			return client
		}

		const sampleUpdate = {
			version: '2.0.0',
			downgrade: false,
			channel: 'stable',
			normalizedVersion: '2.0.0',
			changelog: 'Fix bugs',
			files: [],
			device: {
				manufacturerId: 1,
				productType: 2,
				productId: 3,
				firmwareVersion: '1.0.0',
			},
		}

		it('checkAllNodesFirmwareUpdates clears stale updates for eligible nodes omitted from the bulk result map', async () => {
			const driverNodes = new Map([
				[
					2,
					{
						id: 2,
						manufacturerId: 1,
						productType: 2,
						productId: 3,
						firmwareVersion: '2.0.0',
					},
				],
				[
					3,
					{
						id: 3,
						manufacturerId: 1,
						productType: 2,
						productId: 4,
						firmwareVersion: '1.0.0',
					},
				],
				[
					4,
					{
						id: 4,
						manufacturerId: 1,
						productType: 2,
						productId: 5,
						// firmwareVersion unknown -> not included in bulk check
					},
				],
			])

			const client = createFirmwareClient({
				driverNodes,
				getAllAvailableFirmwareUpdates: vi.fn().mockResolvedValue(
					new Map([
						[
							3,
							[
								{
									...sampleUpdate,
									version: '3.0.0',
								},
							],
						],
					]),
				),
			})

			client['_nodes'].set(2, {
				id: 2,
				availableFirmwareUpdates: [sampleUpdate],
				firmwareUpdatesDismissed: { '2.0.0': true },
				lastFirmwareUpdateCheck: 100,
			} as any)
			client['storeNodes'][2] = {
				availableFirmwareUpdates: [sampleUpdate],
				firmwareUpdatesDismissed: { '2.0.0': true },
				lastFirmwareUpdateCheck: 100,
			} as any

			client['_nodes'].set(3, {
				id: 3,
				availableFirmwareUpdates: [],
				firmwareUpdatesDismissed: {},
				lastFirmwareUpdateCheck: 0,
			} as any)

			// Node 4 has no firmwareVersion yet (e.g. uninterviewed), so its cached info must not be wiped
			client['_nodes'].set(4, {
				id: 4,
				availableFirmwareUpdates: [sampleUpdate],
				firmwareUpdatesDismissed: {},
				lastFirmwareUpdateCheck: 100,
			} as any)
			client['storeNodes'][4] = {
				availableFirmwareUpdates: [sampleUpdate],
				firmwareUpdatesDismissed: {},
				lastFirmwareUpdateCheck: 100,
			} as any

			await client.checkAllNodesFirmwareUpdates()

			expect(
				client['_nodes'].get(2)?.availableFirmwareUpdates,
			).to.deep.equal([])
			expect(
				client['storeNodes'][2].availableFirmwareUpdates,
			).to.deep.equal([])
			expect(
				client['storeNodes'][2].firmwareUpdatesDismissed,
			).to.deep.equal({})
			expect(client['emitNodeUpdate']).toHaveBeenCalledWith(
				client['_nodes'].get(2),
				expect.objectContaining({
					availableFirmwareUpdates: [],
					firmwareUpdatesDismissed: {},
				}),
			)

			expect(
				client['_nodes'].get(3)?.availableFirmwareUpdates,
			).toHaveLength(1)
			expect(
				client['_nodes'].get(4)?.availableFirmwareUpdates,
			).to.deep.equal([sampleUpdate])
			expect(client['updateStoreNodes']).toHaveBeenCalledTimes(1)
		})

		it('_onNodeFirmwareUpdateFinished clears availableFirmwareUpdates on success even without re-interview or when auto-checks are disabled', () => {
			const client = createFirmwareClient({
				disableAutomaticFirmwareUpdateChecks: true,
			})
			const node = {
				id: 5,
				firmwareUpdate: { progress: 100 },
				availableFirmwareUpdates: [sampleUpdate],
				firmwareUpdatesDismissed: { '2.0.0': true },
				lastFirmwareUpdateCheck: 100,
			} as any
			client['_nodes'].set(5, node)
			client['storeNodes'][5] = {
				availableFirmwareUpdates: [sampleUpdate],
				firmwareUpdatesDismissed: { '2.0.0': true },
				lastFirmwareUpdateCheck: 100,
			} as any

			client['_onNodeFirmwareUpdateFinished'](
				{ id: 5 } as any,
				{
					success: true,
					status: 255,
					reInterview: false,
				} as any,
			)

			expect(node.firmwareUpdate).toBeUndefined()
			expect(node.availableFirmwareUpdates).to.deep.equal([])
			expect(
				client['storeNodes'][5].availableFirmwareUpdates,
			).to.deep.equal([])
			expect(
				client['storeNodes'][5].firmwareUpdatesDismissed,
			).to.deep.equal({})
			expect(client['updateStoreNodes']).toHaveBeenCalledWith(false)
			expect(client['emitNodeUpdate']).toHaveBeenCalledWith(
				node,
				expect.objectContaining({
					availableFirmwareUpdates: [],
				}),
			)
		})

		it('_onNodeFirmwareUpdateFinished keeps availableFirmwareUpdates when update fails', () => {
			const client = createFirmwareClient()
			const node = {
				id: 6,
				firmwareUpdate: { progress: 50 },
				availableFirmwareUpdates: [sampleUpdate],
				firmwareUpdatesDismissed: {},
				lastFirmwareUpdateCheck: 100,
			} as any
			client['_nodes'].set(6, node)
			client['storeNodes'][6] = {
				availableFirmwareUpdates: [sampleUpdate],
				firmwareUpdatesDismissed: {},
				lastFirmwareUpdateCheck: 100,
			} as any

			client['_onNodeFirmwareUpdateFinished'](
				{ id: 6 } as any,
				{
					success: false,
					status: 0,
					reInterview: false,
				} as any,
			)

			expect(node.firmwareUpdate).toBeUndefined()
			expect(node.availableFirmwareUpdates).to.deep.equal([sampleUpdate])
			expect(
				client['storeNodes'][6].availableFirmwareUpdates,
			).to.deep.equal([sampleUpdate])
		})

		it('getAvailableFirmwareUpdates clears stale updates when stable check returns empty', async () => {
			const client = createFirmwareClient({
				getAvailableFirmwareUpdates: vi.fn().mockResolvedValue([]),
			})
			const node = {
				id: 7,
				availableFirmwareUpdates: [sampleUpdate],
				firmwareUpdatesDismissed: {},
				lastFirmwareUpdateCheck: 100,
			} as any
			client['_nodes'].set(7, node)
			client['storeNodes'][7] = {
				availableFirmwareUpdates: [sampleUpdate],
				firmwareUpdatesDismissed: {},
				lastFirmwareUpdateCheck: 100,
			} as any

			const result = await client.getAvailableFirmwareUpdates(7, {
				includePrereleases: false,
			})

			expect(result).to.deep.equal([])
			expect(node.availableFirmwareUpdates).to.deep.equal([])
			expect(
				client['storeNodes'][7].availableFirmwareUpdates,
			).to.deep.equal([])
			expect(client['updateStoreNodes']).toHaveBeenCalledWith(false)
		})

		it('getAvailableFirmwareUpdates does not store prereleases in availableFirmwareUpdates when includePrereleases is true', async () => {
			const prereleaseUpdate = {
				...sampleUpdate,
				version: '2.1.0-beta.1',
				channel: 'beta',
			}
			const client = createFirmwareClient({
				getAvailableFirmwareUpdates: vi
					.fn()
					.mockResolvedValue([prereleaseUpdate]),
			})
			const node = {
				id: 8,
				availableFirmwareUpdates: [],
				firmwareUpdatesDismissed: {},
				lastFirmwareUpdateCheck: 100,
			} as any
			client['_nodes'].set(8, node)

			const result = await client.getAvailableFirmwareUpdates(8, {
				includePrereleases: true,
			})

			expect(result).to.deep.equal([prereleaseUpdate])
			expect(node.availableFirmwareUpdates).to.deep.equal([])
			expect(client['updateStoreNodes']).not.toHaveBeenCalled()
		})

		it('getAvailableFirmwareUpdates clears stale updates when includePrereleases is true and returns empty', async () => {
			const client = createFirmwareClient({
				getAvailableFirmwareUpdates: vi.fn().mockResolvedValue([]),
			})
			const node = {
				id: 9,
				availableFirmwareUpdates: [sampleUpdate],
				firmwareUpdatesDismissed: {},
				lastFirmwareUpdateCheck: 100,
			} as any
			client['_nodes'].set(9, node)
			client['storeNodes'][9] = {
				availableFirmwareUpdates: [sampleUpdate],
				firmwareUpdatesDismissed: {},
				lastFirmwareUpdateCheck: 100,
			} as any

			const result = await client.getAvailableFirmwareUpdates(9, {
				includePrereleases: true,
			})

			expect(result).to.deep.equal([])
			expect(node.availableFirmwareUpdates).to.deep.equal([])
			expect(
				client['storeNodes'][9].availableFirmwareUpdates,
			).to.deep.equal([])
			expect(client['updateStoreNodes']).toHaveBeenCalledWith(false)
		})

		it('getAvailableFirmwareUpdates clears stale stable updates when includePrereleases is true and only beta updates are returned', async () => {
			const prereleaseUpdate = {
				...sampleUpdate,
				version: '2.1.0-beta.1',
				channel: 'beta',
			}
			const client = createFirmwareClient({
				getAvailableFirmwareUpdates: vi
					.fn()
					.mockResolvedValue([prereleaseUpdate]),
			})
			const node = {
				id: 11,
				availableFirmwareUpdates: [sampleUpdate],
				firmwareUpdatesDismissed: { '2.0.0': true },
				lastFirmwareUpdateCheck: 100,
			} as any
			client['_nodes'].set(11, node)
			client['storeNodes'][11] = {
				availableFirmwareUpdates: [sampleUpdate],
				firmwareUpdatesDismissed: { '2.0.0': true },
				lastFirmwareUpdateCheck: 100,
			} as any

			const result = await client.getAvailableFirmwareUpdates(11, {
				includePrereleases: true,
			})

			expect(result).to.deep.equal([prereleaseUpdate])
			expect(node.availableFirmwareUpdates).to.deep.equal([])
			expect(node.firmwareUpdatesDismissed).to.deep.equal({})
			expect(
				client['storeNodes'][11].availableFirmwareUpdates,
			).to.deep.equal([])
			expect(client['updateStoreNodes']).toHaveBeenCalledWith(false)
		})

		it('_onOTWFirmwareUpdateFinished clears controller availableFirmwareUpdates only on success', () => {
			const client = createFirmwareClient()
			client['sendToSocket'] = vi.fn()
			const controllerNode = {
				id: 1,
				availableFirmwareUpdates: [sampleUpdate],
				firmwareUpdatesDismissed: { '2.0.0': true },
				lastFirmwareUpdateCheck: 100,
			} as any
			client['_nodes'].set(1, controllerNode)
			client['storeNodes'][1] = {
				availableFirmwareUpdates: [sampleUpdate],
				firmwareUpdatesDismissed: { '2.0.0': true },
				lastFirmwareUpdateCheck: 100,
			} as any

			client['_onOTWFirmwareUpdateFinished']({
				success: false,
				status: 0,
			} as any)
			expect(controllerNode.availableFirmwareUpdates).to.deep.equal([
				sampleUpdate,
			])

			client['_onOTWFirmwareUpdateFinished']({
				success: true,
				status: 255,
			} as any)
			expect(controllerNode.availableFirmwareUpdates).to.deep.equal([])
			expect(
				client['storeNodes'][1].availableFirmwareUpdates,
			).to.deep.equal([])
			expect(client['updateStoreNodes']).toHaveBeenCalledWith(false)
		})

		it('checkAllNodesFirmwareUpdates skips emitting for omitted nodes with no stale firmware info', async () => {
			const driverNodes = new Map([
				[
					10,
					{
						id: 10,
						manufacturerId: 1,
						productType: 2,
						productId: 3,
						firmwareVersion: '1.0.0',
					},
				],
			])
			const client = createFirmwareClient({
				driverNodes,
				getAllAvailableFirmwareUpdates: vi
					.fn()
					.mockResolvedValue(new Map()),
			})
			client['_nodes'].set(10, {
				id: 10,
				availableFirmwareUpdates: [],
				firmwareUpdatesDismissed: {},
				lastFirmwareUpdateCheck: 0,
			} as any)

			await client.checkAllNodesFirmwareUpdates()

			expect(client['emitNodeUpdate']).not.toHaveBeenCalled()
			expect(client['storeNodes'][10]).toBeUndefined()
		})
	})
})
