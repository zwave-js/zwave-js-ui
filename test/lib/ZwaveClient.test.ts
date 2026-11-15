import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import ZwaveClient from '../../api/lib/ZwaveClient.ts'
import { DriverLifecycle } from '../../api/lib/zwave/DriverLifecycle.ts'

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

	// The schedule and template methods are thin facades; pin each binding so
	// a swapped argument or a wrong target method fails here.
	describe('service facades', () => {
		const range = { min: '1.0' }
		const slot = { userId: 1, slotId: 1, startHour: 1 }
		const cases: [string, string, string, unknown[]][] = [
			[
				'_scheduleService',
				'getSchedules',
				'getSchedules',
				[2, { fromCache: false }],
			],
			['_scheduleService', 'cancelGetSchedule', 'cancelGetSchedule', []],
			[
				'_scheduleService',
				'setSchedule',
				'setSchedule',
				[2, 'daily', slot],
			],
			[
				'_scheduleService',
				'setEnabledSchedule',
				'setEnabledSchedule',
				[2, true, 3],
			],
			[
				'_configTemplateService',
				'getConfigurationTemplates',
				'getConfigurationTemplates',
				[],
			],
			[
				'_configTemplateService',
				'getDeviceConfigurationParams',
				'getDeviceConfigurationParams',
				['1-2-3'],
			],
			[
				'_configTemplateService',
				'createConfigurationTemplate',
				'createConfigurationTemplate',
				[2, 'T', true, [], range],
			],
			[
				'_configTemplateService',
				'updateConfigurationTemplate',
				'updateConfigurationTemplate',
				['id', { name: 'N' }],
			],
			[
				'_configTemplateService',
				'deleteConfigurationTemplate',
				'deleteConfigurationTemplate',
				['id'],
			],
			[
				'_configTemplateService',
				'applyConfigurationTemplate',
				'applyConfigurationTemplate',
				['id', 2, true],
			],
			[
				'_configTemplateService',
				'importConfigurationTemplates',
				'importConfigurationTemplates',
				[[]],
			],
			[
				'_configTemplateService',
				'_checkConfigurationTemplates',
				'checkConfigurationTemplates',
				[{ id: 2 }, { id: 2 }],
			],
		]

		const voidTargets = new Set([
			'cancelGetSchedule',
			'checkConfigurationTemplates',
		])

		it.each(cases)(
			'%s.%s forwards %s',
			async (service, facade, target, args) => {
				const client = Object.create(ZwaveClient.prototype)
				const result = Symbol('result')
				const fn = vi.fn(() => result)
				client[service] = { [target]: fn }

				expect(await client[facade](...args)).toBe(
					voidTargets.has(target) ? undefined : result,
				)
				expect(fn).toHaveBeenCalledExactlyOnceWith(...args)
			},
		)

		it('getSchedules defaults to reading from cache', async () => {
			const client = Object.create(ZwaveClient.prototype)
			const fn = vi.fn()
			client._scheduleService = { getSchedules: fn }

			await client.getSchedules(2)

			expect(fn).toHaveBeenCalledWith(2, { fromCache: true })
		})
	})

	describe('inclusion coordinator wiring', () => {
		function createWiredClient(
			options: {
				isReplacing?: boolean
				tmpNode?: { name?: string; loc?: string }
			} = {},
		) {
			const client = Object.create(ZwaveClient.prototype) as ZwaveClient
			const coordinator = {
				isReplacing: options.isReplacing ?? false,
				clearPendingNode: vi.fn(),
				onReplacementComplete: vi.fn(),
				takeTmpNode: vi.fn(() => options.tmpNode),
			}
			const updateStoreNodes = vi.fn().mockResolvedValue(undefined)
			Object.assign(client, {
				_inclusionCoordinator: coordinator,
				_nodes: new Map(),
				storeNodes: {},
				_driver: {
					controller: {
						getPrioritySUCReturnRouteCached: vi.fn(),
						getCustomSUCReturnRoutesCached: vi.fn(),
					},
				},
				updateStoreNodes,
				sendToSocket: vi.fn(),
				emit: vi.fn(),
			})
			return { client, coordinator, updateStoreNodes }
		}

		it('keeps the stored node while a replacement is in progress', () => {
			const { client, coordinator, updateStoreNodes } = createWiredClient(
				{ isReplacing: true },
			)
			client['storeNodes'][5] = { name: 'Lamp' }

			client['_removeNode'](5)

			expect(coordinator.clearPendingNode).toHaveBeenCalledWith(5)
			expect(client['storeNodes'][5]).toEqual({ name: 'Lamp' })
			expect(updateStoreNodes).not.toHaveBeenCalled()
		})

		it('drops the stored node when no replacement is running', () => {
			const { client, updateStoreNodes } = createWiredClient()
			client['storeNodes'][5] = { name: 'Lamp' }

			client['_removeNode'](5)

			expect(client['storeNodes'][5]).toBeUndefined()
			expect(updateStoreNodes).toHaveBeenCalledWith(false)
		})

		it('skips the store write for a node that was never stored', () => {
			const { client, updateStoreNodes } = createWiredClient()

			client['_removeNode'](5)

			expect(updateStoreNodes).not.toHaveBeenCalled()
		})

		it('applies the inclusion name and location to the new node', () => {
			const { client, coordinator } = createWiredClient({
				tmpNode: { name: 'Lamp', loc: 'Kitchen' },
			})

			const node = client['_createNode'](5)

			expect(coordinator.takeTmpNode).toHaveBeenCalledTimes(1)
			expect(node.name).toBe('Lamp')
			expect(node.loc).toBe('Kitchen')
			expect(client['storeNodes'][5]).toEqual({
				name: 'Lamp',
				loc: 'Kitchen',
			})
		})

		it.each([
			['hardReset()', (client: ZwaveClient) => client.hardReset()],
			[
				'a zwave-js-server hard reset',
				(client: ZwaveClient) => {
					client['_reinitAfterHardReset']()
					return Promise.resolve()
				},
			],
		])('reinstalls user callbacks after %s', async (_name, reset) => {
			const { client, coordinator } = createWiredClient()
			const init = vi.fn()
			const reinstallUserCallbacks = vi.fn()
			Object.assign(coordinator, { reinstallUserCallbacks })
			Object.assign(client, {
				init,
				_driver: { hardReset: vi.fn().mockResolvedValue(undefined) },
			})
			Object.defineProperty(client, 'driverReady', { value: true })

			await reset(client)

			expect(init).toHaveBeenCalledTimes(1)
			expect(reinstallUserCallbacks).toHaveBeenCalledTimes(1)
			expect(init.mock.invocationCallOrder[0]).toBeLessThan(
				reinstallUserCallbacks.mock.invocationCallOrder[0],
			)
		})

		it('resets both lifecycle services on close', async () => {
			const { client, coordinator } = createWiredClient()
			const reset = vi.fn()
			const resetGeneration = vi.fn()
			Object.assign(coordinator, { reset })
			Object.assign(client, {
				_firmwareUpdateService: { resetGeneration },
				_serverManager: {
					destroy: vi.fn().mockResolvedValue(undefined),
				},
				_driver: null,
				throttledFunctions: new Map(),
			})
			// close() runs through the lifecycle, wired to the client's own host
			client['_driverLifecycle'] = new DriverLifecycle(
				client['_buildDriverLifecycleHost'](),
				client['_serverManager'],
			)

			await client.close(true)

			expect(reset).toHaveBeenCalledTimes(1)
			expect(resetGeneration).toHaveBeenCalledTimes(1)
		})

		it('completes the replacement when the new node is added', async () => {
			const { client, coordinator } = createWiredClient()
			Object.assign(client, {
				_driverReady: false,
				logNode: vi.fn(),
				zwaveNodeToJSON: vi.fn(),
			})

			await client['_onNodeAdded'](
				{ id: 5 } as never,
				{ lowSecurity: false } as never,
			)

			expect(coordinator.clearPendingNode).toHaveBeenCalledWith(5)
			expect(coordinator.onReplacementComplete).toHaveBeenCalledTimes(1)
		})
	})
})
