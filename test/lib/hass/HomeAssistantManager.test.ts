/**
 * Direct unit tests for {@link HomeAssistantManager}, the `AppRuntime`-owned
 * lifecycle coordinator for the built-in Home Assistant subsystem.
 *
 * The coordinator does not re-implement the discovery / `@zwave-js/server`
 * lifecycles (those stay owned by the live `Gateway`/`ZwaveClient`); it gives
 * the subsystem a single process-lifetime owner with an idempotent
 * initialize -> bind -> start -> stop lifecycle that always resolves the
 * CURRENT sub-managers through always-current resolvers (never a stale
 * capture). These tests drive it in isolation with hand-rolled collaborator
 * resolvers so every lifecycle transition, idempotency guard, current-manager
 * resolution, partial-failure tolerance and the status-quiesce-on-stop path is
 * proven against the coordinator itself. The end-to-end wiring into
 * `AppRuntime` (ordering relative to the clients) is covered by
 * `test/runtime/AppRuntime.test.ts`.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Mock } from 'vitest'
import HomeAssistantManager, {
	type HassDiscoverySubsystem,
	type HassServerSubsystem,
	type HomeAssistantCollaborators,
} from '../../../api/hass/HomeAssistantManager.ts'

// A logger whose methods are function-valued PROPERTIES (not method
// signatures) so tests can reference `logger.info` for assertions without the
// unbound-method rule firing; structurally satisfies `HassLogger`.
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

/** A fake discovery subsystem exposing a spyable idempotent `disposeStatus`. */
function makeDiscovery(): HassDiscoverySubsystem & { disposeStatus: Mock } {
	return { disposeStatus: vi.fn() }
}

/** A fake `@zwave-js/server` subsystem with a fixed reported version. */
function makeServer(version: string): HassServerSubsystem {
	return { version }
}

/**
 * A mutable resolver bundle: the objects returned by `resolveDiscovery` /
 * `resolveServer` can be swapped between calls so tests can prove the
 * coordinator always reads the CURRENT sub-manager and never caches.
 */
function makeCollaborators(): HomeAssistantCollaborators & {
	setDiscovery(d: HassDiscoverySubsystem | undefined): void
	setServer(s: HassServerSubsystem | undefined): void
} {
	let discovery: HassDiscoverySubsystem | undefined
	let server: HassServerSubsystem | undefined
	return {
		resolveDiscovery: () => discovery,
		resolveServer: () => server,
		setDiscovery: (d) => {
			discovery = d
		},
		setServer: (s) => {
			server = s
		},
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

			manager.initialize()

			expect(manager.initialized).toBe(true)
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

			expect(manager.initialized).toBe(true)
			// Only the first call logged; ownership is retained silently after.
			expect(logger.info).toHaveBeenCalledTimes(1)
		})
	})

	describe('bind() and facade getters', () => {
		it('resolves nothing before any collaborators are bound', () => {
			const manager = new HomeAssistantManager({ logger })

			expect(manager.discovery).toBeUndefined()
			expect(manager.server).toBeUndefined()
		})

		it('resolves the current collaborators once bound', () => {
			const manager = new HomeAssistantManager({ logger })
			const collaborators = makeCollaborators()
			const discovery = makeDiscovery()
			const server = makeServer('1.2.3')
			collaborators.setDiscovery(discovery)
			collaborators.setServer(server)

			manager.bind(collaborators)

			expect(manager.discovery).toBe(discovery)
			expect(manager.server).toBe(server)
		})

		it('always reads the CURRENT sub-manager (no stale capture)', () => {
			const manager = new HomeAssistantManager({ logger })
			const collaborators = makeCollaborators()
			manager.bind(collaborators)

			const first = makeDiscovery()
			collaborators.setDiscovery(first)
			expect(manager.discovery).toBe(first)

			// Simulate a gateway replaced mid-restart: the resolver now returns a
			// brand-new discovery manager. The coordinator must observe it
			// immediately without any rebind.
			const second = makeDiscovery()
			collaborators.setDiscovery(second)
			expect(manager.discovery).toBe(second)

			// And a subsystem that becomes absent (e.g. MQTT disabled) resolves
			// back to undefined rather than a cached instance.
			collaborators.setDiscovery(undefined)
			expect(manager.discovery).toBeUndefined()
		})

		it('can be re-bound to a fresh resolver bundle', () => {
			const manager = new HomeAssistantManager({ logger })
			const first = makeCollaborators()
			const firstServer = makeServer('1.0.0')
			first.setServer(firstServer)
			manager.bind(first)
			expect(manager.server).toBe(firstServer)

			const second = makeCollaborators()
			const secondServer = makeServer('2.0.0')
			second.setServer(secondServer)
			manager.bind(second)
			expect(manager.server).toBe(secondServer)
		})
	})

	describe('start()', () => {
		it('marks the subsystem active and logs both subsystems present', () => {
			const manager = new HomeAssistantManager({ logger })
			const collaborators = makeCollaborators()
			collaborators.setDiscovery(makeDiscovery())
			collaborators.setServer(makeServer('9.9.9'))
			manager.bind(collaborators)

			expect(manager.started).toBe(false)
			manager.start()

			expect(manager.started).toBe(true)
			expect(logger.info).toHaveBeenCalledWith(
				'Home Assistant subsystem started (discovery: active, server: 9.9.9)',
			)
		})

		it('tolerates entirely absent collaborators (partial failure)', () => {
			const manager = new HomeAssistantManager({ logger })

			// Never bound: every resolver is missing. Must not throw and must
			// report both subsystems inactive.
			expect(() => manager.start()).not.toThrow()
			expect(manager.started).toBe(true)
			expect(logger.info).toHaveBeenCalledWith(
				'Home Assistant subsystem started (discovery: inactive, server: inactive)',
			)
		})

		it('reports each subsystem independently', () => {
			const manager = new HomeAssistantManager({ logger })
			const collaborators = makeCollaborators()
			// Discovery present, server absent.
			collaborators.setDiscovery(makeDiscovery())
			manager.bind(collaborators)

			manager.start()

			expect(logger.info).toHaveBeenCalledWith(
				'Home Assistant subsystem started (discovery: active, server: inactive)',
			)
		})

		it('resolves the CURRENT server version at start time', () => {
			const manager = new HomeAssistantManager({ logger })
			const collaborators = makeCollaborators()
			manager.bind(collaborators)
			// Version only becomes resolvable after the client started, i.e.
			// after bind - proving start reads live, not at bind time.
			collaborators.setServer(makeServer('3.10.0'))

			manager.start()

			expect(logger.info).toHaveBeenCalledWith(
				'Home Assistant subsystem started (discovery: inactive, server: 3.10.0)',
			)
		})

		it('is idempotent - a second start is a no-op', () => {
			const manager = new HomeAssistantManager({ logger })
			manager.start()
			logger.info.mockClear()

			manager.start()

			expect(manager.started).toBe(true)
			expect(logger.info).not.toHaveBeenCalled()
		})
	})

	describe('stop()', () => {
		it('quiesces the current discovery status subscription', () => {
			const manager = new HomeAssistantManager({ logger })
			const collaborators = makeCollaborators()
			const discovery = makeDiscovery()
			collaborators.setDiscovery(discovery)
			manager.bind(collaborators)
			manager.start()
			logger.info.mockClear()

			manager.stop()

			expect(discovery.disposeStatus).toHaveBeenCalledTimes(1)
			expect(manager.started).toBe(false)
			expect(logger.info).toHaveBeenCalledWith(
				'Home Assistant subsystem stopped',
			)
		})

		it('is a no-op when never started (no discovery touched)', () => {
			const manager = new HomeAssistantManager({ logger })
			const collaborators = makeCollaborators()
			const discovery = makeDiscovery()
			collaborators.setDiscovery(discovery)
			manager.bind(collaborators)

			manager.stop()

			expect(discovery.disposeStatus).not.toHaveBeenCalled()
			expect(manager.started).toBe(false)
			expect(logger.info).not.toHaveBeenCalled()
		})

		it('tolerates an absent discovery subsystem while started', () => {
			const manager = new HomeAssistantManager({ logger })
			// No collaborators bound at all: started, then stop must not throw.
			manager.start()
			logger.info.mockClear()

			expect(() => manager.stop()).not.toThrow()
			expect(manager.started).toBe(false)
			expect(logger.info).toHaveBeenCalledWith(
				'Home Assistant subsystem stopped',
			)
		})

		it('disposes the CURRENT discovery manager, not a start-time capture', () => {
			const manager = new HomeAssistantManager({ logger })
			const collaborators = makeCollaborators()
			const atStart = makeDiscovery()
			collaborators.setDiscovery(atStart)
			manager.bind(collaborators)
			manager.start()

			// Gateway replaced between start and stop.
			const atStop = makeDiscovery()
			collaborators.setDiscovery(atStop)

			manager.stop()

			expect(atStart.disposeStatus).not.toHaveBeenCalled()
			expect(atStop.disposeStatus).toHaveBeenCalledTimes(1)
		})
	})

	describe('restart', () => {
		it('supports start -> stop -> start again', () => {
			const manager = new HomeAssistantManager({ logger })
			const collaborators = makeCollaborators()
			const discovery = makeDiscovery()
			collaborators.setDiscovery(discovery)
			collaborators.setServer(makeServer('1.0.0'))
			manager.bind(collaborators)

			manager.start()
			expect(manager.started).toBe(true)

			manager.stop()
			expect(manager.started).toBe(false)
			expect(discovery.disposeStatus).toHaveBeenCalledTimes(1)

			manager.start()
			expect(manager.started).toBe(true)

			// Two distinct "started" logs across the two start calls.
			const startedLogs = logger.info.mock.calls.filter((call) =>
				String(call[0]).startsWith('Home Assistant subsystem started'),
			)
			expect(startedLogs).toHaveLength(2)
		})
	})
})
