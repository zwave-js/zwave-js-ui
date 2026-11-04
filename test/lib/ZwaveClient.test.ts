import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { SetUserResult } from 'zwave-js'
import ZwaveClient from '../../api/lib/ZwaveClient.ts'

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

	describe('access-control local user names', () => {
		// These methods only touch `storeNodes`, `updateStoreNodes` and the
		// access-control resolution helpers, so the constructor (which reads
		// json stores and needs a socket server) is skipped here too.
		const NODE_ID = 5
		const ENDPOINT_INDEX = 0

		let client: ZwaveClient
		let accessControl: {
			deleteUser: ReturnType<typeof vi.fn>
			deleteAllUsers: ReturnType<typeof vi.fn>
		}

		beforeEach(() => {
			client = Object.create(ZwaveClient.prototype) as ZwaveClient
			client['storeNodes'] = {}
			client['_requireNode'] = vi.fn().mockReturnValue({ id: NODE_ID })
			accessControl = {
				deleteUser: vi.fn(),
				deleteAllUsers: vi.fn(),
			}
			client['_resolveAccessControlEndpoint'] = vi
				.fn()
				.mockImplementation((_zwaveNode, endpointIndex) => ({
					index: endpointIndex ?? ENDPOINT_INDEX,
					accessControl,
					endpoint: {},
				}))
			client['updateStoreNodes'] = vi.fn().mockResolvedValue(undefined)
			client['_refreshAccessControlState'] = vi.fn()
		})

		describe('#accessControlSetUserLocalName()', () => {
			it('stores a local name, creating the nested store entries', async () => {
				await client.accessControlSetUserLocalName(
					NODE_ID,
					ENDPOINT_INDEX,
					1,
					'Front door key',
				)

				expect(
					client['storeNodes'][NODE_ID].accessControlUserNames[
						ENDPOINT_INDEX
					][1],
				).to.equal('Front door key')
				expect(client['updateStoreNodes']).toHaveBeenCalledTimes(1)
				expect(
					client['_refreshAccessControlState'],
				).toHaveBeenCalledWith({ id: NODE_ID })
			})

			it('overwrites an existing local name for the same user', async () => {
				await client.accessControlSetUserLocalName(
					NODE_ID,
					ENDPOINT_INDEX,
					1,
					'Old name',
				)
				await client.accessControlSetUserLocalName(
					NODE_ID,
					ENDPOINT_INDEX,
					1,
					'New name',
				)

				expect(
					client['storeNodes'][NODE_ID].accessControlUserNames[
						ENDPOINT_INDEX
					][1],
				).to.equal('New name')
			})

			it('clears the local name when given an empty string', async () => {
				await client.accessControlSetUserLocalName(
					NODE_ID,
					ENDPOINT_INDEX,
					1,
					'Front door key',
				)
				await client.accessControlSetUserLocalName(
					NODE_ID,
					ENDPOINT_INDEX,
					1,
					'',
				)

				expect(
					client['storeNodes'][NODE_ID].accessControlUserNames[
						ENDPOINT_INDEX
					],
				).to.not.have.property('1')
			})

			it('keys names by endpoint so different endpoints do not collide', async () => {
				await client.accessControlSetUserLocalName(
					NODE_ID,
					0,
					1,
					'Root',
				)
				await client.accessControlSetUserLocalName(
					NODE_ID,
					2,
					1,
					'Endpoint 2',
				)

				expect(
					client['storeNodes'][NODE_ID].accessControlUserNames[0][1],
				).to.equal('Root')
				expect(
					client['storeNodes'][NODE_ID].accessControlUserNames[2][1],
				).to.equal('Endpoint 2')
			})
		})

		describe('#accessControlDeleteUser()', () => {
			beforeEach(() => {
				client['storeNodes'][NODE_ID] = {
					accessControlUserNames: {
						[ENDPOINT_INDEX]: { 1: 'Front door key', 2: 'Garage' },
					},
				} as never
			})

			it('removes the stored local name once the device confirms deletion', async () => {
				accessControl.deleteUser.mockResolvedValue(SetUserResult.OK)

				const result = await client.accessControlDeleteUser(
					NODE_ID,
					ENDPOINT_INDEX,
					1,
				)

				expect(result).to.equal(SetUserResult.OK)
				expect(
					client['storeNodes'][NODE_ID].accessControlUserNames[
						ENDPOINT_INDEX
					],
				).to.deep.equal({ 2: 'Garage' })
				expect(client['updateStoreNodes']).toHaveBeenCalledTimes(1)
			})

			it('leaves the stored local name untouched when the device refuses', async () => {
				accessControl.deleteUser.mockResolvedValue(
					SetUserResult.Error_Unknown,
				)

				await client.accessControlDeleteUser(NODE_ID, ENDPOINT_INDEX, 1)

				expect(
					client['storeNodes'][NODE_ID].accessControlUserNames[
						ENDPOINT_INDEX
					],
				).to.deep.equal({ 1: 'Front door key', 2: 'Garage' })
				expect(client['updateStoreNodes']).not.toHaveBeenCalled()
			})
		})

		describe('#accessControlDeleteAllUsers()', () => {
			beforeEach(() => {
				client['storeNodes'][NODE_ID] = {
					accessControlUserNames: {
						[ENDPOINT_INDEX]: { 1: 'Front door key', 2: 'Garage' },
					},
				} as never
			})

			it('clears every stored local name once the device confirms deletion', async () => {
				accessControl.deleteAllUsers.mockResolvedValue(SetUserResult.OK)

				const result = await client.accessControlDeleteAllUsers(
					NODE_ID,
					ENDPOINT_INDEX,
				)

				expect(result).to.equal(SetUserResult.OK)
				expect(
					client['storeNodes'][NODE_ID].accessControlUserNames[
						ENDPOINT_INDEX
					],
				).to.deep.equal({})
				expect(client['updateStoreNodes']).toHaveBeenCalledTimes(1)
				expect(client['_refreshAccessControlState']).toHaveBeenCalled()
			})

			it('leaves stored local names untouched when the device refuses', async () => {
				accessControl.deleteAllUsers.mockResolvedValue(
					SetUserResult.Error_Unknown,
				)

				await client.accessControlDeleteAllUsers(
					NODE_ID,
					ENDPOINT_INDEX,
				)

				expect(
					client['storeNodes'][NODE_ID].accessControlUserNames[
						ENDPOINT_INDEX
					],
				).to.deep.equal({ 1: 'Front door key', 2: 'Garage' })
				expect(client['updateStoreNodes']).not.toHaveBeenCalled()
				expect(
					client['_refreshAccessControlState'],
				).not.toHaveBeenCalled()
			})
		})
	})
})
