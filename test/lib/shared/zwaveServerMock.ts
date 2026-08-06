/**
 * Shared `@zwave-js/server` fake for the suites that drive the server lifecycle
 * (`ZwaveServerManager.test.ts` directly, `server.test.ts` through
 * `ZwaveClient`). Faithful to the two upstream details those tests depend on:
 * `start()` assigns the internal `server` prop the duplicate-start guard reads,
 * and `destroy()` resolves a tick late so an ordering assertion can prove the
 * caller awaited it.
 *
 * Used as `vi.mock('@zwave-js/server', () => zwaveServerMockFactory(hoisted))`,
 * following the `mqttMock.ts` precedent: `vi.mock` hoists the call but runs the
 * factory lazily, so it may reach this import as long as the state holder comes
 * from `vi.hoisted`.
 */
import { vi } from 'vitest'

export interface ZwaveServerMockState {
	/** Every constructed instance, in order */
	servers: any[]
	/** Records `'server'` when a destroy resolves, so callers can assert order */
	destroyOrder: string[]
	SERVER_VERSION: string
}

export async function zwaveServerMockFactory(state: ZwaveServerMockState) {
	const { EventEmitter } = await import('node:events')

	class ZwavejsServerMock extends EventEmitter {
		driver: any
		options: any
		/** Undefined until `start()`, mirroring the real class */
		server: any = undefined
		/** Undefined until a socket is accepted; guards inclusion hand-back */
		sockets: any = undefined
		setInclusionUserCallbacks = vi.fn()
		start = vi.fn((..._args: any[]) => {
			this.server = {}
			return Promise.resolve()
		})
		destroy = vi.fn(
			() =>
				new Promise<void>((resolve) => {
					setImmediate(() => {
						state.destroyOrder.push('server')
						resolve()
					})
				}),
		)

		constructor(driver: any, options: any) {
			super()
			this.driver = driver
			this.options = options
			state.servers.push(this)
		}
	}

	return {
		serverVersion: state.SERVER_VERSION,
		ZwavejsServer: ZwavejsServerMock,
	}
}
