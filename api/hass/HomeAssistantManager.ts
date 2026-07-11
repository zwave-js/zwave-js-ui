import type { HassLogger } from './ports.ts'

/**
 * Narrow control handle for the legacy MQTT discovery subsystem the coordinator
 * owns. `MqttDiscoveryManager` structurally satisfies this. The coordinator
 * only ever needs to STOP it (halt every discovery producer, listener and the
 * scoped HA/broker status subscription); the discovery effective-start stays
 * locked to `Gateway.start()`, driven on the very instance the coordinator
 * constructed and the gateway adopted.
 */
export interface HassManagedDiscovery {
	/**
	 * Halt all discovery producers/listeners/watchers/subscriptions.
	 * Idempotent and reentrant.
	 */
	stop(): void
}

/**
 * Narrow control handle for the `@zwave-js/server` subsystem the coordinator
 * owns. `ZwaveServerManager` structurally satisfies this. The coordinator
 * constructs it, the `ZwaveClient` drives create/start at the locked driver
 * points, and the coordinator awaits its destroy on stop so the server is gone
 * before the driver is destroyed.
 */
export interface HassManagedServer {
	/** The upstream `@zwave-js/server` package version. */
	readonly version: string
	/**
	 * Tear the server down, awaiting its shutdown so the caller can guarantee
	 * the server (and its port) is released before the driver. Idempotent.
	 */
	destroy(): Promise<void>
}

/**
 * Factory bundle the coordinator owns to construct AND wire a fresh generation
 * of sub-managers into the current clients. Each `create*` constructs the
 * concrete manager for the CURRENT gateway/client, adopts it into that client
 * (so the client drives it at the locked timing points) and returns the narrow
 * control handle the coordinator holds. Building the concrete instance behind
 * this seam keeps the coordinator decoupled from the concrete client classes
 * (no import cycle, no downcast). `createServer` may return `undefined` when
 * the generation has no Z-Wave client (e.g. `settings.zwave` absent).
 */
export interface HomeAssistantClientFactories {
	createDiscovery(): HassManagedDiscovery
	createServer(): HassManagedServer | undefined
}

export interface HomeAssistantManagerOptions {
	logger: HassLogger
}

/**
 * Lifecycle states of the Home Assistant subsystem.
 *
 *  - `idle`: constructed, not yet owned. Before {@link HomeAssistantManager.initialize}.
 *  - `initialized`: ownership taken, no generation attached yet. Also the
 *    resting state a completed {@link HomeAssistantManager.stop} returns to
 *    (ready for a restart).
 *  - `starting`: a fresh generation has been
 *    {@link HomeAssistantManager.attachClients attached} and the clients are
 *    starting it (discovery at `Gateway.start()`, server at driver-ready).
 *  - `started`: {@link HomeAssistantManager.start} confirmed the generation is up.
 *  - `stopping`: {@link HomeAssistantManager.stop} is quiescing the current
 *    generation (async, while it awaits the server destroy).
 *  - `failed`: a startup failure was recorded via
 *    {@link HomeAssistantManager.markFailed}; still stoppable so the coordinator
 *    can quiesce it.
 */
export type HomeAssistantLifecycleState =
	| 'idle'
	| 'initialized'
	| 'starting'
	| 'started'
	| 'stopping'
	| 'failed'

/**
 * The single, process-lifetime owner of the built-in Home Assistant subsystem.
 *
 * Unlike the earlier hollow coordinator, this object genuinely OWNS the legacy
 * MQTT discovery manager and the `@zwave-js/server` manager: it constructs a
 * fresh generation of both through the injected
 * {@link HomeAssistantClientFactories} (which also adopt them into the current
 * `Gateway`/`ZwaveClient`), holds the instances plus their disposers, and
 * drives their lifecycle through an explicit, idempotent state machine:
 *
 *  - {@link initialize} (once, before any client is constructed),
 *  - {@link attachClients} (construct + adopt a fresh generation into the new
 *    clients, before they start),
 *  - {@link start} (confirm the generation is up, after `Gateway.start()`),
 *  - {@link stop} (quiesce: halt every discovery producer/listener/subscription
 *    and AWAIT the server destroy, before the clients are closed), and
 *  - {@link markFailed} (record a startup failure so the subsequent stop still
 *    quiesces the partially-started generation).
 *
 * The discovery/server effective START stays locked to `Gateway.start()` and
 * the `ZwaveClient` driver points respectively - those clients drive the very
 * instances this manager constructed and they adopted - so no timing changes.
 * Every transition is idempotent and safe from any state; concurrent stops
 * share one in-flight teardown; a restart attaches a brand-new generation (the
 * previous one is disposed), so nothing stale ever survives.
 */
export default class HomeAssistantManager {
	private readonly logger: HassLogger
	private _state: HomeAssistantLifecycleState = 'idle'
	private _generation = 0
	private _discovery: HassManagedDiscovery | undefined
	private _server: HassManagedServer | undefined
	private stopInFlight: Promise<void> | undefined

	public constructor(options: HomeAssistantManagerOptions) {
		this.logger = options.logger
	}

	/** The current lifecycle state. */
	public get state(): HomeAssistantLifecycleState {
		return this._state
	}

	/** Whether {@link initialize} has run (ownership taken). */
	public get initialized(): boolean {
		return this._state !== 'idle'
	}

	/** Whether the subsystem is currently started. */
	public get started(): boolean {
		return this._state === 'started'
	}

	/**
	 * Monotonic generation counter, bumped on every {@link attachClients}. Lets
	 * tests assert that a restart wired a brand-new generation rather than
	 * reusing a stale one.
	 */
	public get generation(): number {
		return this._generation
	}

	/** The discovery manager the current generation owns, if any. */
	public get discovery(): HassManagedDiscovery | undefined {
		return this._discovery
	}

	/** The `@zwave-js/server` manager the current generation owns, if any. */
	public get server(): HassManagedServer | undefined {
		return this._server
	}

	/**
	 * Take ownership of the subsystem before any client is constructed.
	 * Idempotent: a second call (a restart re-entering) is a no-op beyond
	 * keeping ownership; it never regresses a running generation.
	 */
	public initialize(): void {
		if (this._state !== 'idle') return
		this._state = 'initialized'
		this.logger.info('Home Assistant subsystem initialized')
	}

	/**
	 * Construct a fresh generation of sub-managers through the injected
	 * factories (which also adopt them into the current clients) and take
	 * ownership of them. Called by `AppRuntime` after the new clients exist but
	 * BEFORE they start, so the discovery/server the clients drive at their
	 * locked timing points are the ones this manager owns.
	 *
	 * Bumps {@link generation} and moves to `starting`. Any lingering previous
	 * generation's discovery is defensively halted first (the async server
	 * destroy is owned by the coordinated {@link stop}, which `AppRuntime`
	 * always runs before re-attaching), so no producer leaks even on a misuse
	 * that skipped a stop.
	 */
	public attachClients(factories: HomeAssistantClientFactories): void {
		if (this._state === 'idle') this.initialize()

		// Defensive: a live generation replaced without a stop first. Halt its
		// discovery synchronously so nothing leaks. (AppRuntime always stops
		// before re-attaching, so this only guards misuse/partial failures.)
		if (this._discovery) this._discovery.stop()

		this._generation += 1
		this._discovery = factories.createDiscovery()
		this._server = factories.createServer()
		this._state = 'starting'
		this.logger.info(
			`Home Assistant subsystem attached (generation ${this._generation})`,
		)
	}

	/**
	 * Confirm the current generation is up, once `Gateway.start()` has started
	 * discovery (and, through the driver, the server). Idempotent: a no-op when
	 * already started, or when nothing is attached to start.
	 */
	public start(): void {
		if (this._state === 'started') return
		// Only a freshly attached generation can be started. From any other
		// state (no clients attached, stopping, failed) this is a safe no-op.
		if (this._state !== 'starting') return

		this._state = 'started'
		this.logger.info(
			`Home Assistant subsystem started (server: ${
				this._server ? this._server.version : 'inactive'
			})`,
		)
	}

	/**
	 * Record that the current generation failed to start (e.g. `Gateway.start()`
	 * threw). Keeps the owned handles so the subsequent {@link stop} can still
	 * quiesce the partially-started generation. Idempotent; only meaningful
	 * while starting/started.
	 */
	public markFailed(): void {
		if (this._state === 'starting' || this._state === 'started') {
			this._state = 'failed'
			this.logger.warn('Home Assistant subsystem entered failed state')
		}
	}

	/**
	 * Quiesce the current generation BEFORE the clients are closed: halt every
	 * discovery producer/listener/subscription and AWAIT the `@zwave-js/server`
	 * destroy, so no rediscovery races the shutdown and the server (and its
	 * port) is released before the driver is destroyed.
	 *
	 * Idempotent, concurrency-safe and generation-scoped:
	 *  - from `idle`/`initialized` (nothing started) it is a no-op;
	 *  - from `starting`/`started`/`failed` it runs the teardown once and, on
	 *    success, settles back to `initialized`, ready for a restart;
	 *  - concurrent calls share the single in-flight teardown promise;
	 *  - the teardown captures the generation it is quiescing and clears the
	 *    owned handles/state ONLY if that generation is still current, so an
	 *    overlapping re-attach (a newer generation wired while this stop is
	 *    awaiting the server destroy) is never erased by a stale stop;
	 *  - if the server `destroy()` rejects, the owned handles are RETAINED
	 *    (retryable), the state moves to `failed` (observable) and the rejection
	 *    is re-thrown; the in-flight guard is always released so a later stop
	 *    retries the teardown.
	 */
	public async stop(): Promise<void> {
		if (this.stopInFlight) return this.stopInFlight
		if (this._state === 'idle' || this._state === 'initialized') return

		const generation = this._generation
		this._state = 'stopping'
		const discovery = this._discovery
		const server = this._server

		this.stopInFlight = (async () => {
			try {
				// Halt discovery producers/listeners/subscriptions first...
				discovery?.stop()
				// ...then await the server quiesce/destroy so it (and its port)
				// is gone before the driver is destroyed downstream.
				await server?.destroy()
				// Success: clear the owned handles only if no newer generation
				// was wired while we were quiescing. An overlapping re-attach
				// owns `_discovery`/`_server`/`_state` now and must survive.
				if (this._generation === generation) {
					this._discovery = undefined
					this._server = undefined
					this._state = 'initialized'
					this.logger.info('Home Assistant subsystem stopped')
				}
			} catch (error) {
				// The server destroy (or a discovery halt) rejected: retain the
				// handles so a later stop can retry, and surface a failed state
				// (unless a newer generation already superseded us). Re-throw so
				// the caller observes the failure.
				if (this._generation === generation) {
					this._state = 'failed'
				}
				throw error
			} finally {
				this.stopInFlight = undefined
			}
		})()

		return this.stopInFlight
	}
}
