/**
 * Direct unit tests for {@link HomeAssistantManager}, the single
 * process-lifetime owner of the built-in Home Assistant subsystem.
 *
 * This manager owns a generation of sub-managers: it constructs them through
 * the injected {@link HomeAssistantClientFactories} (which also adopt them into
 * the current clients), holds the concrete instances plus their disposers, and
 * drives an explicit, idempotent lifecycle state machine
 * (`idle -> initialized -> starting -> started -> stopping -> initialized`,
 * plus `failed`). These tests drive it in isolation with hand-rolled factories
 * so every transition, the teardown call order, idempotency from every state,
 * concurrent-stop de-duplication, restart (fresh generation), partial attach
 * (no server) and the failed-then-quiesce path are proven against the manager
 * itself. The end-to-end wiring into `AppRuntime` is covered by
 * `test/runtime/AppRuntime.test.ts`.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Mock } from 'vitest'
import HomeAssistantManager, {
	type HassManagedDiscovery,
	type HassManagedServer,
	type HomeAssistantClientFactories,
} from '../../../api/hass/HomeAssistantManager.ts'

// Methods declared as function-valued properties let tests reference
// `logger.info` for assertions without the unbound-method rule firing
interface MockLogger {
	debug: Mock
	info: Mock
	warn: Mock
	error: Mock
	log: Mock
}

function makeLogger(): MockLogger {
	return {
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		log: vi.fn(),
	}
}

/** A fake discovery handle exposing a spyable idempotent `stop`. */
type FakeDiscovery = HassManagedDiscovery & { stop: Mock }
function makeDiscovery(): FakeDiscovery {
	return { stop: vi.fn() }
}

/** A fake `@zwave-js/server` handle with a fixed version and spyable destroy. */
type FakeServer = HassManagedServer & { destroy: Mock }
function makeServer(version: string): FakeServer {
	return { version, destroy: vi.fn().mockResolvedValue(undefined) }
}

/**
 * A factory bundle wrapping fixed discovery/server instances, recording how
 * many times each `create*` was invoked so tests can prove the manager
 * constructs exactly one fresh generation per attach.
 */
function makeFactories(
	discovery: HassManagedDiscovery | undefined,
	server: HassManagedServer | undefined,
): HomeAssistantClientFactories & {
	createDiscovery: Mock
	createServer: Mock
} {
	return {
		createDiscovery: vi.fn(() => discovery),
		createServer: vi.fn(() => server),
	}
}

describe('HomeAssistantManager', () => {
	let logger: MockLogger

	beforeEach(() => {
		logger = makeLogger()
	})

	describe('initialize()', () => {
		it('takes ownership and logs on first call', () => {
			const manager = new HomeAssistantManager({ logger })
			expect(manager.initialized).toBe(false)
			expect(manager.state).toBe('idle')

			manager.initialize()

			expect(manager.initialized).toBe(true)
			expect(manager.state).toBe('initialized')
			expect(logger.info).toHaveBeenCalledTimes(1)
			expect(logger.info).toHaveBeenCalledWith(
				'Home Assistant subsystem initialized',
			)
		})

		it('is idempotent - a second call (e.g. a restart) is a no-op', () => {
			const manager = new HomeAssistantManager({ logger })

			manager.initialize()
			manager.initialize()
			manager.initialize()

			expect(manager.state).toBe('initialized')
			// Only the first call logged; ownership is retained silently after.
			expect(logger.info).toHaveBeenCalledTimes(1)
		})
	})

	describe('attachClients()', () => {
		it('constructs and OWNS a fresh generation through the factories', () => {
			const manager = new HomeAssistantManager({ logger })
			manager.initialize()
			const discovery = makeDiscovery()
			const server = makeServer('1.2.3')
			const factories = makeFactories(discovery, server)

			manager.attachClients(factories)

			// Exactly one of each was constructed...
			expect(factories.createDiscovery).toHaveBeenCalledTimes(1)
			expect(factories.createServer).toHaveBeenCalledTimes(1)
			// the manager holds the concrete instances returned, owning them
			// directly rather than resolving into a client
			expect(manager.discovery).toBe(discovery)
			expect(manager.server).toBe(server)
			expect(manager.state).toBe('starting')
			expect(manager.generation).toBe(1)
			expect(logger.info).toHaveBeenCalledWith(
				'Home Assistant subsystem attached (generation 1)',
			)
		})

		it('auto-initializes when attached straight from idle', () => {
			const manager = new HomeAssistantManager({ logger })
			expect(manager.state).toBe('idle')

			manager.attachClients(
				makeFactories(makeDiscovery(), makeServer('1')),
			)

			expect(manager.initialized).toBe(true)
			expect(manager.state).toBe('starting')
			// The auto-initialize still logged the ownership line first.
			expect(logger.info).toHaveBeenCalledWith(
				'Home Assistant subsystem initialized',
			)
		})

		it('tolerates a generation with no server (createServer -> undefined)', () => {
			const manager = new HomeAssistantManager({ logger })
			const discovery = makeDiscovery()
			const factories = makeFactories(discovery, undefined)

			manager.attachClients(factories)

			expect(manager.discovery).toBe(discovery)
			expect(manager.server).toBeUndefined()
			expect(manager.state).toBe('starting')
		})

		it('defensively halts a lingering discovery if re-attached without a stop', () => {
			const manager = new HomeAssistantManager({ logger })
			const first = makeDiscovery()
			manager.attachClients(makeFactories(first, makeServer('1')))
			expect(manager.generation).toBe(1)

			// A misuse/partial-failure that re-attaches without stopping first:
			// the previous generation's discovery must be halted so no producer
			// leaks, and the new generation replaces it wholesale.
			const second = makeDiscovery()
			manager.attachClients(makeFactories(second, makeServer('2')))

			expect(first.stop).toHaveBeenCalledTimes(1)
			expect(manager.discovery).toBe(second)
			expect(manager.generation).toBe(2)
		})
	})

	describe('start()', () => {
		it('advances starting -> started and logs the server version', () => {
			const manager = new HomeAssistantManager({ logger })
			manager.attachClients(
				makeFactories(makeDiscovery(), makeServer('9.9.9')),
			)
			logger.info.mockClear()

			expect(manager.started).toBe(false)
			manager.start()

			expect(manager.started).toBe(true)
			expect(manager.state).toBe('started')
			expect(logger.info).toHaveBeenCalledWith(
				'Home Assistant subsystem started (server: 9.9.9)',
			)
		})

		it('reports an inactive server when the generation has none', () => {
			const manager = new HomeAssistantManager({ logger })
			manager.attachClients(makeFactories(makeDiscovery(), undefined))
			logger.info.mockClear()

			manager.start()

			expect(logger.info).toHaveBeenCalledWith(
				'Home Assistant subsystem started (server: inactive)',
			)
		})

		it('is a no-op before any generation is attached', () => {
			const manager = new HomeAssistantManager({ logger })
			manager.initialize()
			logger.info.mockClear()

			manager.start()

			expect(manager.started).toBe(false)
			expect(manager.state).toBe('initialized')
			expect(logger.info).not.toHaveBeenCalled()
		})

		it('is idempotent - a second start is a no-op', () => {
			const manager = new HomeAssistantManager({ logger })
			manager.attachClients(
				makeFactories(makeDiscovery(), makeServer('1')),
			)
			manager.start()
			logger.info.mockClear()

			manager.start()

			expect(manager.started).toBe(true)
			expect(logger.info).not.toHaveBeenCalled()
		})
	})

	describe('markFailed()', () => {
		it('moves starting -> failed while retaining the owned handles', () => {
			const manager = new HomeAssistantManager({ logger })
			const discovery = makeDiscovery()
			const server = makeServer('1')
			manager.attachClients(makeFactories(discovery, server))

			manager.markFailed()

			expect(manager.state).toBe('failed')
			// Handles retained so the subsequent stop can still quiesce them.
			expect(manager.discovery).toBe(discovery)
			expect(manager.server).toBe(server)
			expect(logger.warn).toHaveBeenCalledWith(
				'Home Assistant subsystem entered failed state',
			)
		})

		it('moves started -> failed', () => {
			const manager = new HomeAssistantManager({ logger })
			manager.attachClients(
				makeFactories(makeDiscovery(), makeServer('1')),
			)
			manager.start()

			manager.markFailed()

			expect(manager.state).toBe('failed')
		})

		it('is a no-op from initialized (nothing to fail)', () => {
			const manager = new HomeAssistantManager({ logger })
			manager.initialize()

			manager.markFailed()

			expect(manager.state).toBe('initialized')
			expect(logger.warn).not.toHaveBeenCalled()
		})
	})

	describe('stop()', () => {
		it('quiesces discovery THEN awaits the server destroy, in that order', async () => {
			const manager = new HomeAssistantManager({ logger })
			const order: string[] = []
			const discovery: FakeDiscovery = {
				stop: vi.fn(() => {
					order.push('discovery.stop')
				}),
			}
			const server: FakeServer = {
				version: '1',
				destroy: vi.fn(() => {
					order.push('server.destroy')
					return Promise.resolve()
				}),
			}
			manager.attachClients(makeFactories(discovery, server))
			manager.start()
			logger.info.mockClear()

			await manager.stop()

			expect(order).toEqual(['discovery.stop', 'server.destroy'])
			expect(discovery.stop).toHaveBeenCalledTimes(1)
			expect(server.destroy).toHaveBeenCalledTimes(1)
			// Settled back to initialized, ready for a restart, handles cleared.
			expect(manager.state).toBe('initialized')
			expect(manager.started).toBe(false)
			expect(manager.discovery).toBeUndefined()
			expect(manager.server).toBeUndefined()
			expect(logger.info).toHaveBeenCalledWith(
				'Home Assistant subsystem stopped',
			)
		})

		it('is a no-op from idle', async () => {
			const manager = new HomeAssistantManager({ logger })

			await manager.stop()

			expect(manager.state).toBe('idle')
			expect(logger.info).not.toHaveBeenCalled()
		})

		it('is a no-op from initialized (nothing started)', async () => {
			const manager = new HomeAssistantManager({ logger })
			manager.initialize()
			logger.info.mockClear()

			await manager.stop()

			expect(manager.state).toBe('initialized')
			expect(logger.info).not.toHaveBeenCalled()
		})

		it('quiesces from the starting state (stop during start)', async () => {
			const manager = new HomeAssistantManager({ logger })
			const discovery = makeDiscovery()
			const server = makeServer('1')
			manager.attachClients(makeFactories(discovery, server))
			expect(manager.state).toBe('starting')

			await manager.stop()

			expect(discovery.stop).toHaveBeenCalledTimes(1)
			expect(server.destroy).toHaveBeenCalledTimes(1)
			expect(manager.state).toBe('initialized')
		})

		it('quiesces from the failed state', async () => {
			const manager = new HomeAssistantManager({ logger })
			const discovery = makeDiscovery()
			const server = makeServer('1')
			manager.attachClients(makeFactories(discovery, server))
			manager.markFailed()

			await manager.stop()

			expect(discovery.stop).toHaveBeenCalledTimes(1)
			expect(server.destroy).toHaveBeenCalledTimes(1)
			expect(manager.state).toBe('initialized')
		})

		it('tolerates a generation with no server', async () => {
			const manager = new HomeAssistantManager({ logger })
			const discovery = makeDiscovery()
			manager.attachClients(makeFactories(discovery, undefined))
			manager.start()

			await expect(manager.stop()).resolves.toBeUndefined()

			expect(discovery.stop).toHaveBeenCalledTimes(1)
			expect(manager.state).toBe('initialized')
		})

		it('de-duplicates concurrent stops onto a single in-flight teardown', async () => {
			const manager = new HomeAssistantManager({ logger })
			const discovery = makeDiscovery()
			// A server whose destroy we control, so both stop() calls observe the
			// same in-flight teardown before it settles
			let releaseDestroy: () => void = () => undefined
			const destroyGate = new Promise<void>((resolve) => {
				releaseDestroy = resolve
			})
			const server: FakeServer = {
				version: '1',
				destroy: vi.fn(() => destroyGate),
			}
			manager.attachClients(makeFactories(discovery, server))
			manager.start()

			const first = manager.stop()
			const second = manager.stop()
			// Both callers share a single teardown, so destroy runs once
			expect(server.destroy).toHaveBeenCalledTimes(1)

			releaseDestroy()
			await Promise.all([first, second])

			expect(server.destroy).toHaveBeenCalledTimes(1)
			expect(discovery.stop).toHaveBeenCalledTimes(1)
			expect(manager.state).toBe('initialized')
		})

		it('clears the in-flight guard so a later stop can run again', async () => {
			const manager = new HomeAssistantManager({ logger })
			const discovery = makeDiscovery()
			const server = makeServer('1')
			manager.attachClients(makeFactories(discovery, server))
			manager.start()

			await manager.stop()
			// A second stop after settling is a clean no-op (already initialized).
			await manager.stop()

			expect(discovery.stop).toHaveBeenCalledTimes(1)
			expect(server.destroy).toHaveBeenCalledTimes(1)
		})
	})

	describe('stop() generation-scoped race + failure semantics', () => {
		it('a stale stop does not erase a generation re-attached while it awaits the server destroy', async () => {
			const manager = new HomeAssistantManager({ logger })
			const discovery1 = makeDiscovery()
			// Gate generation 1's destroy so the re-attach interleaves while the
			// stop is still awaiting it.
			let releaseDestroy: () => void = () => undefined
			const destroyGate = new Promise<void>((resolve) => {
				releaseDestroy = resolve
			})
			const server1: FakeServer = {
				version: '1',
				destroy: vi.fn(() => destroyGate),
			}
			manager.attachClients(makeFactories(discovery1, server1))
			manager.start()

			const stopping = manager.stop()
			expect(manager.state).toBe('stopping')

			// A brand-new generation is wired and started while gen 1's stop is
			// mid-flight, awaiting the gated destroy
			const discovery2 = makeDiscovery()
			const server2 = makeServer('2')
			manager.attachClients(makeFactories(discovery2, server2))
			manager.start()
			expect(manager.generation).toBe(2)
			expect(manager.state).toBe('started')

			// Let the stale gen 1 teardown settle; it must not clear gen 2
			releaseDestroy()
			await stopping

			expect(manager.generation).toBe(2)
			expect(manager.state).toBe('started')
			expect(manager.discovery).toBe(discovery2)
			expect(manager.server).toBe(server2)
			// The new generation was never quiesced by the stale stop.
			expect(discovery2.stop).not.toHaveBeenCalled()
			expect(server2.destroy).not.toHaveBeenCalled()
			// The stale generation's own resources were still released exactly once.
			expect(server1.destroy).toHaveBeenCalledTimes(1)
		})

		it('a rejected server destroy retains the handles, enters failed, and is retryable', async () => {
			const manager = new HomeAssistantManager({ logger })
			const discovery = makeDiscovery()
			const server: FakeServer = {
				version: '1',
				destroy: vi
					.fn()
					.mockRejectedValueOnce(new Error('destroy failed'))
					.mockResolvedValueOnce(undefined),
			}
			manager.attachClients(makeFactories(discovery, server))
			manager.start()

			// The rejection is observable to the caller...
			await expect(manager.stop()).rejects.toThrow('destroy failed')
			// ...the failed generation is retained (retryable) and observable.
			expect(manager.state).toBe('failed')
			expect(manager.discovery).toBe(discovery)
			expect(manager.server).toBe(server)

			// A later stop retries the teardown and, on success, settles clean.
			await expect(manager.stop()).resolves.toBeUndefined()
			expect(server.destroy).toHaveBeenCalledTimes(2)
			expect(manager.state).toBe('initialized')
			expect(manager.discovery).toBeUndefined()
			expect(manager.server).toBeUndefined()
		})

		it('concurrent stops share one rejected teardown; a later stop retries', async () => {
			const manager = new HomeAssistantManager({ logger })
			const discovery = makeDiscovery()
			const server: FakeServer = {
				version: '1',
				destroy: vi
					.fn()
					.mockRejectedValueOnce(new Error('boom'))
					.mockResolvedValueOnce(undefined),
			}
			manager.attachClients(makeFactories(discovery, server))
			manager.start()

			const first = manager.stop()
			const second = manager.stop()
			// Both callers observe the same in-flight teardown, so one destroy
			expect(server.destroy).toHaveBeenCalledTimes(1)

			await expect(first).rejects.toThrow('boom')
			await expect(second).rejects.toThrow('boom')
			expect(manager.state).toBe('failed')

			await expect(manager.stop()).resolves.toBeUndefined()
			expect(server.destroy).toHaveBeenCalledTimes(2)
			expect(manager.state).toBe('initialized')
		})

		it('a stale stop that rejects after a re-attach does not corrupt the new generation', async () => {
			const manager = new HomeAssistantManager({ logger })
			const discovery1 = makeDiscovery()
			let rejectDestroy: (error: Error) => void = () => undefined
			const destroyGate = new Promise<void>((_resolve, reject) => {
				rejectDestroy = reject
			})
			const server1: FakeServer = {
				version: '1',
				destroy: vi.fn(() => destroyGate),
			}
			manager.attachClients(makeFactories(discovery1, server1))
			manager.start()

			const stopping = manager.stop()

			const discovery2 = makeDiscovery()
			const server2 = makeServer('2')
			manager.attachClients(makeFactories(discovery2, server2))
			manager.start()

			rejectDestroy(new Error('late failure'))
			await expect(stopping).rejects.toThrow('late failure')

			// A late teardown failure from the prior generation leaves the new
			// one started and unaffected
			expect(manager.state).toBe('started')
			expect(manager.generation).toBe(2)
			expect(manager.discovery).toBe(discovery2)
			expect(manager.server).toBe(server2)
		})
	})

	describe('restart (stop -> re-attach -> start)', () => {
		it('attaches a brand-new generation and never reuses stale handles', async () => {
			const manager = new HomeAssistantManager({ logger })

			// Generation 1.
			const discovery1 = makeDiscovery()
			const server1 = makeServer('1.0.0')
			manager.attachClients(makeFactories(discovery1, server1))
			manager.start()
			expect(manager.generation).toBe(1)

			// Quiesce.
			await manager.stop()
			expect(discovery1.stop).toHaveBeenCalledTimes(1)
			expect(server1.destroy).toHaveBeenCalledTimes(1)
			expect(manager.discovery).toBeUndefined()

			// Generation 2 - a completely fresh pair.
			const discovery2 = makeDiscovery()
			const server2 = makeServer('2.0.0')
			manager.attachClients(makeFactories(discovery2, server2))
			manager.start()

			expect(manager.generation).toBe(2)
			expect(manager.discovery).toBe(discovery2)
			expect(manager.server).toBe(server2)
			// Generation 1's pair was disposed once and never revived by the
			// restart
			expect(discovery1.stop).toHaveBeenCalledTimes(1)
			expect(server1.destroy).toHaveBeenCalledTimes(1)

			// Two distinct "started" logs across the two start calls.
			const startedLogs = logger.info.mock.calls.filter((call) =>
				String(call[0]).startsWith('Home Assistant subsystem started'),
			)
			expect(startedLogs).toHaveLength(2)
		})

		it('survives repeated start/stop cycles idempotently', async () => {
			const manager = new HomeAssistantManager({ logger })

			for (let i = 1; i <= 3; i++) {
				const discovery = makeDiscovery()
				const server = makeServer(`${i}.0.0`)
				manager.attachClients(makeFactories(discovery, server))
				manager.start()
				expect(manager.started).toBe(true)
				expect(manager.generation).toBe(i)

				await manager.stop()
				expect(manager.started).toBe(false)
				expect(discovery.stop).toHaveBeenCalledTimes(1)
				expect(server.destroy).toHaveBeenCalledTimes(1)
			}
		})
	})
})
