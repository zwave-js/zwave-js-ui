import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { driverPresets } from 'zwave-js'
import ZwaveClient from '../../api/lib/ZwaveClient.ts'
import { externalSettingsFixture } from './helpers/externalSettings.ts'

// `throttle` only touches `throttledFunctions`, so these tests skip the real
// constructor. It reads the json stores and needs a socket server.
function createClient() {
	const client = Object.create(ZwaveClient.prototype) as ZwaveClient
	client['throttledFunctions'] = new Map()
	return client
}

describe('#ZwaveClient', () => {
	// The presets have to reach the Driver constructor to be applied at all;
	// building the argument list here is what makes that testable (#4829).
	describe('#buildDriverArgs()', () => {
		let fixture: ReturnType<typeof externalSettingsFixture>

		beforeEach(() => {
			fixture = externalSettingsFixture()
		})

		afterEach(() => {
			fixture.cleanup()
		})

		function buildArgs(presets?: string[]) {
			// no argument clears an ambient ZWAVE_EXTERNAL_SETTINGS too, so the
			// no-presets case can't pick up the operator's real settings file
			fixture.use(presets ? { presets } : undefined)

			const client = Object.create(ZwaveClient.prototype) as ZwaveClient
			client['cfg'] = { port: '/dev/null' } as any
			return client['buildDriverArgs']({ features: { softReset: false } })
		}

		it('passes the port and the options', () => {
			expect(buildArgs()).to.deep.equal([
				'/dev/null',
				{ features: { softReset: false } },
			])
		})

		it('appends the external presets after the options', () => {
			expect(buildArgs(['NO_WATCHDOG'])).to.deep.equal([
				'/dev/null',
				{ features: { softReset: false } },
				driverPresets.NO_WATCHDOG,
			])
		})

		// order decides precedence: the driver merges left to right
		it('keeps several presets in the order they were requested', () => {
			expect(buildArgs(['NO_WATCHDOG', 'SAFE_MODE'])).to.deep.equal([
				'/dev/null',
				{ features: { softReset: false } },
				driverPresets.NO_WATCHDOG,
				driverPresets.SAFE_MODE,
			])
		})
	})

	describe('#effectiveOptionsLog()', () => {
		const options = {
			features: { softReset: false },
			timeouts: { response: 10000 },
			attempts: { sendData: 3 },
			storage: { cacheDir: '/cache' },
		} as any

		function log(overridden: boolean) {
			const client = Object.create(ZwaveClient.prototype) as ZwaveClient
			return client['effectiveOptionsLog'](options, overridden)
		}

		// invisible at the default level, which is info
		it('stays at debug when nothing overrode the settings', () => {
			expect(log(false).level).to.equal('debug')
		})

		it('is raised to info when a preset or raw options applied', () => {
			expect(log(true).level).to.equal('info')
		})

		it('reports the merged groups and nothing else', () => {
			expect(log(true).message).to.equal(
				'Effective driver options: {"features":{"softReset":false},' +
					'"timeouts":{"response":10000},"attempts":{"sendData":3}}',
			)
		})
	})

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
})
