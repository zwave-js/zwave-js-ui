import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Protocols } from '@zwave-js/core'
import { ProvisioningEntryStatus } from 'zwave-js'
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

	describe('#provisionSmartStartNode()', () => {
		const dsk = '12345-12345-12345-12345-12345-12345-12345-12345'
		let client: ZwaveClient
		let provision: ReturnType<typeof vi.fn>

		beforeEach(() => {
			provision = vi.fn()
			client = Object.create(ZwaveClient.prototype) as ZwaveClient
			client['_driverReady'] = true
			client['_driver'] = {
				controller: {
					getProvisioningEntry: () => undefined,
					provisionSmartStartNode: provision,
				},
			} as any
		})

		it('adds a new LR-capable entry without protocol as inactive', async () => {
			const entry = await client.provisionSmartStartNode({
				dsk,
				securityClasses: [],
				supportedProtocols: [Protocols.ZWave, Protocols.ZWaveLongRange],
			})
			expect(entry.status).to.equal(ProvisioningEntryStatus.Inactive)
			expect(provision).toHaveBeenCalledWith(entry)
		})

		it('keeps an LR-capable entry active when a protocol is chosen', async () => {
			const entry = await client.provisionSmartStartNode({
				dsk,
				securityClasses: [],
				supportedProtocols: [Protocols.ZWave, Protocols.ZWaveLongRange],
				protocol: Protocols.ZWaveLongRange,
			})
			expect(entry.status).to.equal(undefined)
		})

		it('keeps an entry without LR support active', async () => {
			const entry = await client.provisionSmartStartNode({
				dsk,
				securityClasses: [],
				supportedProtocols: [Protocols.ZWave],
			})
			expect(entry.status).to.equal(undefined)
		})
	})
})
