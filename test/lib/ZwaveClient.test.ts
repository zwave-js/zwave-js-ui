import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import ZwaveClient from '../../api/lib/ZwaveClient.ts'
import jsonStore from '../../api/lib/jsonStore.ts'

// `#throttle()` only touches `throttledFunctions`, so it skips the real
// constructor (which calls `jsonStore.get`); `#firmware updates` constructs
// `ZwaveClient` directly with `jsonStore` mocked so instance-field callbacks exist.
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
			const putSpy = vi
				.spyOn(jsonStore, 'put')
				.mockResolvedValue(undefined as any)
			vi.spyOn(jsonStore, 'get').mockImplementation((entry: any) =>
				Array.isArray(entry?.default) ? [] : {},
			)

			const client = new ZwaveClient(
				{
					disableAutomaticFirmwareUpdateChecks:
						options?.disableAutomaticFirmwareUpdateChecks ?? false,
				} as any,
				null as any,
			)
			client['driverInfo'] = { name: '0x12345678' } as any
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
			return { client, putSpy }
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

		function seedNode(
			client: ZwaveClient,
			id: number,
			{
				updates = [] as any[],
				dismissed = {} as Record<string, boolean>,
				lastCheck = 100,
				firmwareUpdate,
				withStore = true,
			}: {
				updates?: any[]
				dismissed?: Record<string, boolean>
				lastCheck?: number
				firmwareUpdate?: any
				withStore?: boolean
			} = {},
		) {
			const node = {
				id,
				...(firmwareUpdate !== undefined ? { firmwareUpdate } : {}),
				availableFirmwareUpdates: [...updates],
				firmwareUpdatesDismissed: { ...dismissed },
				lastFirmwareUpdateCheck: lastCheck,
			} as any
			client['_nodes'].set(id, node)
			if (withStore) {
				client['storeNodes'][id] = {
					availableFirmwareUpdates: [...updates],
					firmwareUpdatesDismissed: { ...dismissed },
					lastFirmwareUpdateCheck: lastCheck,
				} as any
			}
			return node
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

			const { client, putSpy } = createFirmwareClient({
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

			const node2 = seedNode(client, 2, {
				updates: [sampleUpdate],
				dismissed: { '2.0.0': true },
			})
			const node3 = seedNode(client, 3, {
				lastCheck: 0,
				withStore: false,
			})
			// Node 4 has no firmwareVersion yet (e.g. uninterviewed), so its cached info must not be wiped
			const node4 = seedNode(client, 4, { updates: [sampleUpdate] })

			await client.checkAllNodesFirmwareUpdates()

			expect(node2.availableFirmwareUpdates).to.deep.equal([])
			expect(
				client['storeNodes'][2].availableFirmwareUpdates,
			).to.deep.equal([])
			expect(
				client['storeNodes'][2].firmwareUpdatesDismissed,
			).to.deep.equal({})

			expect(node3.availableFirmwareUpdates).toHaveLength(1)
			expect(node4.availableFirmwareUpdates).to.deep.equal([sampleUpdate])
			expect(putSpy).toHaveBeenCalledTimes(1)
		})

		it('checkAllNodesFirmwareUpdates clears stale updates when bulk result map is empty', async () => {
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
			])

			const { client, putSpy } = createFirmwareClient({
				driverNodes,
				getAllAvailableFirmwareUpdates: vi
					.fn()
					.mockResolvedValue(new Map()),
			})

			const node2 = seedNode(client, 2, {
				updates: [sampleUpdate],
				dismissed: { '2.0.0': true },
			})

			await client.checkAllNodesFirmwareUpdates()

			expect(node2.availableFirmwareUpdates).to.deep.equal([])
			expect(node2.firmwareUpdatesDismissed).to.deep.equal({})
			expect(
				client['storeNodes'][2].availableFirmwareUpdates,
			).to.deep.equal([])
			expect(putSpy).toHaveBeenCalledTimes(1)
		})

		it('checkAllNodesFirmwareUpdates preserves stale data when getAllAvailableFirmwareUpdates rejects', async () => {
			const { client, putSpy } = createFirmwareClient({
				getAllAvailableFirmwareUpdates: vi
					.fn()
					.mockRejectedValue(new Error('network timeout')),
			})

			const node = seedNode(client, 2, {
				updates: [sampleUpdate],
				dismissed: { '2.0.0': true },
			})

			await expect(client.checkAllNodesFirmwareUpdates()).rejects.toThrow(
				'network timeout',
			)

			expect(node.availableFirmwareUpdates).to.deep.equal([sampleUpdate])
			expect(
				client['storeNodes'][2].availableFirmwareUpdates,
			).to.deep.equal([sampleUpdate])
			expect(node.lastFirmwareUpdateCheck).toBe(100)
			expect(putSpy).not.toHaveBeenCalled()
		})

		it('checkAllNodesFirmwareUpdates skips writing stale results if node firmwareVersion changed in flight', async () => {
			const driverNode = {
				id: 2,
				manufacturerId: 1,
				productType: 2,
				productId: 3,
				firmwareVersion: '1.0.0',
			}
			const driverNodes = new Map([[2, driverNode]])
			const getAllAvailableFirmwareUpdates = vi.fn()
			const { client } = createFirmwareClient({
				driverNodes,
				getAllAvailableFirmwareUpdates,
			})
			getAllAvailableFirmwareUpdates.mockImplementation(() => {
				// Simulate firmware update finishing while bulk check is in flight
				driverNode.firmwareVersion = '2.0.0'
				client['_onNodeFirmwareUpdateFinished'](
					{ id: 2 } as any,
					{
						success: true,
						status: 255,
						reInterview: false,
					} as any,
				)
				return Promise.resolve(new Map([[2, [sampleUpdate]]]))
			})

			const node2 = seedNode(client, 2, {
				updates: [sampleUpdate],
			})

			await client.checkAllNodesFirmwareUpdates()

			expect(node2.availableFirmwareUpdates).to.deep.equal([])
			expect(
				client['storeNodes'][2].availableFirmwareUpdates,
			).to.deep.equal([])
		})

		it('checkAllNodesFirmwareUpdates skips mutating omitted nodes with no stale firmware info', async () => {
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
			const { client } = createFirmwareClient({
				driverNodes,
				getAllAvailableFirmwareUpdates: vi
					.fn()
					.mockResolvedValue(new Map()),
			})
			const node10 = seedNode(client, 10, {
				lastCheck: 0,
				withStore: false,
			})

			await client.checkAllNodesFirmwareUpdates()

			expect(node10.lastFirmwareUpdateCheck).toBe(0)
			expect(client['storeNodes'][10]).toBeUndefined()
		})

		it('_onNodeFirmwareUpdateFinished clears availableFirmwareUpdates on success without wiping dismissed updates or check time', () => {
			const { client, putSpy } = createFirmwareClient({
				disableAutomaticFirmwareUpdateChecks: true,
			})
			const node = seedNode(client, 5, {
				updates: [sampleUpdate],
				dismissed: { '2.0.0': true },
				firmwareUpdate: { progress: 100 },
			})

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
			expect(node.firmwareUpdatesDismissed).to.deep.equal({
				'2.0.0': true,
			})
			expect(node.lastFirmwareUpdateCheck).toBe(100)
			expect(
				client['storeNodes'][5].availableFirmwareUpdates,
			).to.deep.equal([])
			expect(
				client['storeNodes'][5].firmwareUpdatesDismissed,
			).to.deep.equal({ '2.0.0': true })
			expect(client['storeNodes'][5].lastFirmwareUpdateCheck).toBe(100)
			expect(putSpy).toHaveBeenCalledTimes(1)
		})

		it('_onNodeFirmwareUpdateFinished keeps availableFirmwareUpdates when update fails', () => {
			const { client, putSpy } = createFirmwareClient()
			const node = seedNode(client, 6, {
				updates: [sampleUpdate],
				firmwareUpdate: { progress: 50 },
			})

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
			expect(putSpy).not.toHaveBeenCalled()
		})

		it('getAvailableFirmwareUpdates clears stale updates when stable check returns empty', async () => {
			const { client, putSpy } = createFirmwareClient({
				getAvailableFirmwareUpdates: vi.fn().mockResolvedValue([]),
			})
			const node = seedNode(client, 7, { updates: [sampleUpdate] })

			const result = await client.getAvailableFirmwareUpdates(7, {
				includePrereleases: false,
			})

			expect(result).to.deep.equal([])
			expect(node.availableFirmwareUpdates).to.deep.equal([])
			expect(
				client['storeNodes'][7].availableFirmwareUpdates,
			).to.deep.equal([])
			expect(putSpy).toHaveBeenCalledTimes(1)
		})

		it('getAvailableFirmwareUpdates drops downgrades when writing back availableFirmwareUpdates', async () => {
			const downgradeUpdate = {
				...sampleUpdate,
				version: '0.9.0',
				downgrade: true,
			}
			const { client } = createFirmwareClient({
				getAvailableFirmwareUpdates: vi
					.fn()
					.mockResolvedValue([downgradeUpdate, sampleUpdate]),
			})
			const node = seedNode(client, 12)

			const result = await client.getAvailableFirmwareUpdates(12, {
				includePrereleases: false,
			})

			expect(result).to.deep.equal([downgradeUpdate, sampleUpdate])
			expect(node.availableFirmwareUpdates).to.deep.equal([sampleUpdate])
			expect(
				client['storeNodes'][12].availableFirmwareUpdates,
			).to.deep.equal([sampleUpdate])
		})

		it('getAvailableFirmwareUpdates stores stable updates and excludes beta updates when includePrereleases is true', async () => {
			const prereleaseUpdate = {
				...sampleUpdate,
				version: '2.1.0-beta.1',
				channel: 'beta',
			}
			const { client, putSpy } = createFirmwareClient({
				getAvailableFirmwareUpdates: vi
					.fn()
					.mockResolvedValue([sampleUpdate, prereleaseUpdate]),
			})
			const node = seedNode(client, 8, {
				updates: [{ ...sampleUpdate, version: '1.5.0' }],
			})

			const result = await client.getAvailableFirmwareUpdates(8, {
				includePrereleases: true,
			})

			expect(result).to.deep.equal([sampleUpdate, prereleaseUpdate])
			expect(node.availableFirmwareUpdates).to.deep.equal([sampleUpdate])
			expect(
				client['storeNodes'][8].availableFirmwareUpdates,
			).to.deep.equal([sampleUpdate])
			expect(putSpy).toHaveBeenCalledTimes(1)
		})

		it('getAvailableFirmwareUpdates clears stale stable updates when includePrereleases is true and only beta updates are returned', async () => {
			const prereleaseUpdate = {
				...sampleUpdate,
				version: '2.1.0-beta.1',
				channel: 'beta',
			}
			const { client } = createFirmwareClient({
				getAvailableFirmwareUpdates: vi
					.fn()
					.mockResolvedValue([prereleaseUpdate]),
			})
			const node = seedNode(client, 11, {
				updates: [sampleUpdate],
				dismissed: { '2.0.0': true },
			})

			const result = await client.getAvailableFirmwareUpdates(11, {
				includePrereleases: true,
			})

			expect(result).to.deep.equal([prereleaseUpdate])
			expect(node.availableFirmwareUpdates).to.deep.equal([])
			expect(node.firmwareUpdatesDismissed).to.deep.equal({})
			expect(
				client['storeNodes'][11].availableFirmwareUpdates,
			).to.deep.equal([])
		})

		it('_onOTWFirmwareUpdateFinished clears controller availableFirmwareUpdates only on success without wiping dismissed updates or check time', () => {
			const { client, putSpy } = createFirmwareClient()
			const controllerNode = seedNode(client, 1, {
				updates: [sampleUpdate],
				dismissed: { '2.0.0': true },
			})

			client['_onOTWFirmwareUpdateFinished']({
				success: false,
				status: 0,
			} as any)
			expect(controllerNode.availableFirmwareUpdates).to.deep.equal([
				sampleUpdate,
			])
			expect(putSpy).not.toHaveBeenCalled()

			client['_onOTWFirmwareUpdateFinished']({
				success: true,
				status: 255,
			} as any)
			expect(controllerNode.availableFirmwareUpdates).to.deep.equal([])
			expect(controllerNode.firmwareUpdatesDismissed).to.deep.equal({
				'2.0.0': true,
			})
			expect(controllerNode.lastFirmwareUpdateCheck).toBe(100)
			expect(
				client['storeNodes'][1].availableFirmwareUpdates,
			).to.deep.equal([])
			expect(
				client['storeNodes'][1].firmwareUpdatesDismissed,
			).to.deep.equal({ '2.0.0': true })
			expect(client['storeNodes'][1].lastFirmwareUpdateCheck).toBe(100)
			expect(putSpy).toHaveBeenCalledTimes(1)
		})
	})
})
