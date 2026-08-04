/**
 * Direct unit tests for {@link HomeAssistantManager}, the single
 * process-lifetime owner of the built-in Home Assistant subsystem.
 *
 * The manager holds one generation's discovery + `@zwave-js/server` handles
 * (the clients own the instances) and drives their ordered, idempotent
 * teardown. These tests drive it in isolation with hand-rolled handles and
 * assert observable behavior — the teardown call order and counts, idempotency,
 * concurrent-stop de-duplication, the clean-slate re-attach guard, the partial
 * (no server) generation, and the retryable failure path — rather than internal
 * state. The end-to-end wiring into `AppRuntime` is covered by
 * `test/runtime/AppRuntime.test.ts`.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { vi } from 'vitest'
import type { Mock } from 'vitest'
import HomeAssistantManager, {
	type HassManagedDiscovery,
	type HassManagedServer,
	type HomeAssistantGeneration,
} from '#api/hass/HomeAssistantManager.ts'
import { makeHassLogger, type MockHassLogger } from './fixtures.ts'

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

function generation(
	discovery: HassManagedDiscovery,
	server: HassManagedServer | undefined,
): HomeAssistantGeneration {
	return { discovery, server }
}

describe('HomeAssistantManager', () => {
	let logger: MockHassLogger

	beforeEach(() => {
		logger = makeHassLogger()
	})

	describe('initialize()', () => {
		it('logs ownership on the first call and is idempotent after', () => {
			const manager = new HomeAssistantManager({ logger })

			manager.initialize()
			manager.initialize()
			manager.initialize()

			// Only the first call logs; ownership is retained silently after
			expect(logger.info).toHaveBeenCalledTimes(1)
			expect(logger.info).toHaveBeenCalledWith(
				'Home Assistant subsystem initialized',
			)
		})
	})

	describe('attachClients()', () => {
		it('auto-initializes and logs the attach', () => {
			const manager = new HomeAssistantManager({ logger })

			manager.attachClients(generation(makeDiscovery(), makeServer('1')))

			// The auto-initialize logged the ownership line first, then attach
			expect(logger.info).toHaveBeenCalledWith(
				'Home Assistant subsystem initialized',
			)
			expect(logger.info).toHaveBeenCalledWith(
				'Home Assistant subsystem attached',
			)
		})

		it('tolerates a generation with no server', async () => {
			const manager = new HomeAssistantManager({ logger })
			const discovery = makeDiscovery()

			manager.attachClients(generation(discovery, undefined))
			manager.start()

			// A serverless generation still stops cleanly, halting discovery
			await expect(manager.stop()).resolves.toBeUndefined()
			expect(discovery.stop).toHaveBeenCalledTimes(1)
		})

		it('refuses to re-attach while a generation is still live', () => {
			const manager = new HomeAssistantManager({ logger })
			const first = makeDiscovery()
			manager.attachClients(generation(first, makeServer('1')))

			// A re-attach without stopping first is a caller ordering bug: it
			// must refuse rather than silently drop and leak the live generation
			expect(() =>
				manager.attachClients(
					generation(makeDiscovery(), makeServer('2')),
				),
			).toThrow(/stop it before attaching/)
			// The live generation is untouched
			expect(first.stop).not.toHaveBeenCalled()
		})

		it('accepts a fresh generation after the previous one is stopped', async () => {
			const manager = new HomeAssistantManager({ logger })
			const discovery1 = makeDiscovery()
			const server1 = makeServer('1')
			manager.attachClients(generation(discovery1, server1))
			manager.start()
			await manager.stop()

			const discovery2 = makeDiscovery()
			const server2 = makeServer('2')
			expect(() =>
				manager.attachClients(generation(discovery2, server2)),
			).not.toThrow()
			manager.start()
			await manager.stop()

			// Each generation's handles were quiesced exactly once, never revived
			expect(discovery1.stop).toHaveBeenCalledTimes(1)
			expect(server1.destroy).toHaveBeenCalledTimes(1)
			expect(discovery2.stop).toHaveBeenCalledTimes(1)
			expect(server2.destroy).toHaveBeenCalledTimes(1)
		})
	})

	describe('start()', () => {
		it('logs the server version once up', () => {
			const manager = new HomeAssistantManager({ logger })
			manager.attachClients(
				generation(makeDiscovery(), makeServer('9.9.9')),
			)
			logger.info.mockClear()

			manager.start()

			expect(logger.info).toHaveBeenCalledWith(
				'Home Assistant subsystem started (server: 9.9.9)',
			)
		})

		it('reports an inactive server when the generation has none', () => {
			const manager = new HomeAssistantManager({ logger })
			manager.attachClients(generation(makeDiscovery(), undefined))
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

			expect(logger.info).not.toHaveBeenCalled()
		})
	})

	describe('stop()', () => {
		it('quiesces discovery THEN awaits the server destroy, logging entry and exit', async () => {
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
			manager.attachClients(generation(discovery, server))
			manager.start()
			logger.info.mockClear()

			await manager.stop()

			expect(order).toEqual(['discovery.stop', 'server.destroy'])
			expect(discovery.stop).toHaveBeenCalledTimes(1)
			expect(server.destroy).toHaveBeenCalledTimes(1)
			expect(logger.info).toHaveBeenCalledWith(
				'Stopping Home Assistant subsystem',
			)
			expect(logger.info).toHaveBeenCalledWith(
				'Home Assistant subsystem stopped',
			)
		})

		it('is a no-op before anything is attached', async () => {
			const manager = new HomeAssistantManager({ logger })
			manager.initialize()
			logger.info.mockClear()

			await manager.stop()

			expect(logger.info).not.toHaveBeenCalled()
		})

		it('is a clean no-op after a successful stop clears the handles', async () => {
			const manager = new HomeAssistantManager({ logger })
			const discovery = makeDiscovery()
			const server = makeServer('1')
			manager.attachClients(generation(discovery, server))
			manager.start()

			await manager.stop()
			// A second stop after settling runs neither handle again
			await manager.stop()

			expect(discovery.stop).toHaveBeenCalledTimes(1)
			expect(server.destroy).toHaveBeenCalledTimes(1)
		})

		it('isolates a throwing discovery stop from the server destroy and aggregates', async () => {
			const manager = new HomeAssistantManager({ logger })
			const discovery: FakeDiscovery = {
				stop: vi.fn(() => {
					throw new Error('discovery boom')
				}),
			}
			const server = makeServer('1')
			manager.attachClients(generation(discovery, server))
			manager.start()

			// A discovery failure must not skip the server destroy; the first
			// error still surfaces to the caller
			await expect(manager.stop()).rejects.toThrow('discovery boom')
			expect(server.destroy).toHaveBeenCalledTimes(1)
			expect(logger.warn).toHaveBeenCalled()
		})

		it('de-duplicates concurrent stops onto a single in-flight teardown', async () => {
			const manager = new HomeAssistantManager({ logger })
			const discovery = makeDiscovery()
			let releaseDestroy: () => void = () => undefined
			const destroyGate = new Promise<void>((resolve) => {
				releaseDestroy = resolve
			})
			const server: FakeServer = {
				version: '1',
				destroy: vi.fn(() => destroyGate),
			}
			manager.attachClients(generation(discovery, server))
			manager.start()

			const first = manager.stop()
			const second = manager.stop()
			// Both callers share a single teardown, so destroy runs once
			expect(server.destroy).toHaveBeenCalledTimes(1)

			releaseDestroy()
			await Promise.all([first, second])

			expect(server.destroy).toHaveBeenCalledTimes(1)
			expect(discovery.stop).toHaveBeenCalledTimes(1)
		})

		it('a rejected server destroy is observable, retryable, and clears on retry', async () => {
			const manager = new HomeAssistantManager({ logger })
			const discovery = makeDiscovery()
			const server: FakeServer = {
				version: '1',
				destroy: vi
					.fn()
					.mockRejectedValueOnce(new Error('destroy failed'))
					.mockResolvedValueOnce(undefined),
			}
			manager.attachClients(generation(discovery, server))
			manager.start()

			// The rejection is observable to the caller...
			await expect(manager.stop()).rejects.toThrow('destroy failed')
			// ...and a later stop retries the teardown and, on success, settles
			await expect(manager.stop()).resolves.toBeUndefined()
			expect(server.destroy).toHaveBeenCalledTimes(2)
			// Handles are cleared once it succeeds: a third stop is a no-op
			await manager.stop()
			expect(server.destroy).toHaveBeenCalledTimes(2)
			expect(discovery.stop).toHaveBeenCalledTimes(2)
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
			manager.attachClients(generation(discovery, server))
			manager.start()

			const first = manager.stop()
			const second = manager.stop()
			// Both callers observe the same in-flight teardown, so one destroy
			expect(server.destroy).toHaveBeenCalledTimes(1)

			await expect(first).rejects.toThrow('boom')
			await expect(second).rejects.toThrow('boom')

			await expect(manager.stop()).resolves.toBeUndefined()
			expect(server.destroy).toHaveBeenCalledTimes(2)
		})
	})
})
