import type { HassLogger } from './ports.ts'

/**
 * Control handle for the discovery subsystem the coordinator owns; exposes only
 * `stop()` because discovery start stays locked to `Gateway.start()` on the
 * instance the coordinator constructed and the gateway adopted.
 */
export interface HassManagedDiscovery {
	/** Halt every discovery producer, listener and subscription; idempotent */
	stop(): void
}

/**
 * Control handle for the `@zwave-js/server` subsystem the coordinator owns; the
 * coordinator awaits `destroy()` so the server's port is released before the
 * driver is destroyed.
 */
export interface HassManagedServer {
	/** The upstream `@zwave-js/server` package version */
	readonly version: string
	/** Tear down the server, awaiting shutdown so its port is released before the driver; idempotent */
	destroy(): Promise<void>
}

/**
 * Factories that construct a sub-manager against the current gateway/client and
 * adopt it into that client, returning the control handle the coordinator
 * holds. Building the concrete instance behind this seam keeps the coordinator
 * decoupled from the client classes, so there is no import cycle. `createServer`
 * returns `undefined` when the generation has no Z-Wave client.
 */
export interface HomeAssistantClientFactories {
	createDiscovery(): HassManagedDiscovery
	createServer(): HassManagedServer | undefined
}

export interface HomeAssistantManagerOptions {
	logger: HassLogger
}

/**
 * Lifecycle states of the Home Assistant subsystem. `initialized` is both the
 * pre-attach state and the resting state a completed {@link
 * HomeAssistantManager.stop} returns to; `failed` stays stoppable so the
 * coordinator can still quiesce a partially-started generation.
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
 * Constructs a fresh generation of the discovery and `@zwave-js/server`
 * managers through the injected {@link HomeAssistantClientFactories}, holds
 * their disposers, and drives an idempotent state machine.
 *
 * Discovery/server start stays locked to `Gateway.start()` and the driver
 * points, since the clients drive the very instances this manager constructed.
 * Concurrent stops share one in-flight teardown, and a restart attaches a fresh
 * generation with the previous one disposed.
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

	public get state(): HomeAssistantLifecycleState {
		return this._state
	}

	/** Whether {@link initialize} has run (ownership taken). */
	public get initialized(): boolean {
		return this._state !== 'idle'
	}

	public get started(): boolean {
		return this._state === 'started'
	}

	/** Monotonic counter bumped on every {@link attachClients}, so a restart is always a fresh generation */
	public get generation(): number {
		return this._generation
	}

	public get discovery(): HassManagedDiscovery | undefined {
		return this._discovery
	}

	public get server(): HassManagedServer | undefined {
		return this._server
	}

	/** Take ownership before any client is constructed; idempotent so a restart re-entering never regresses a running generation */
	public initialize(): void {
		if (this._state !== 'idle') return
		this._state = 'initialized'
		this.logger.info('Home Assistant subsystem initialized')
	}

	/**
	 * Construct and adopt a fresh generation through the injected factories.
	 * Called after the new clients exist but before they start, so the clients
	 * drive the instances this manager owns at their locked timing points.
	 */
	public attachClients(factories: HomeAssistantClientFactories): void {
		if (this._state === 'idle') this.initialize()

		// Halt a still-live generation's discovery synchronously so nothing
		// leaks when a generation is replaced without a stop first
		if (this._discovery) this._discovery.stop()

		this._generation += 1
		this._discovery = factories.createDiscovery()
		this._server = factories.createServer()
		this._state = 'starting'
		this.logger.info(
			`Home Assistant subsystem attached (generation ${this._generation})`,
		)
	}

	/** Confirm the current generation is up, once `Gateway.start()` has started discovery and the server; idempotent */
	public start(): void {
		if (this._state === 'started') return
		// Only a freshly attached generation can be started
		if (this._state !== 'starting') return

		this._state = 'started'
		this.logger.info(
			`Home Assistant subsystem started (server: ${
				this._server ? this._server.version : 'inactive'
			})`,
		)
	}

	/** Record a startup failure, keeping the owned handles so a subsequent {@link stop} can still quiesce the partial generation */
	public markFailed(): void {
		if (this._state === 'starting' || this._state === 'started') {
			this._state = 'failed'
			this.logger.warn('Home Assistant subsystem entered failed state')
		}
	}

	/**
	 * Quiesce the current generation before the clients close: halt discovery,
	 * then await the `@zwave-js/server` destroy so the server's port is released
	 * before the driver is destroyed.
	 *
	 * Concurrent calls share one in-flight teardown. The teardown captures its
	 * generation and only clears the owned handles if that generation is still
	 * current, so an overlapping re-attach is never erased by a stale stop. A
	 * rejected destroy retains the handles (retryable) and moves to `failed`.
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
				discovery?.stop()
				// Await the server destroy so its port is gone before the
				// driver is destroyed downstream
				await server?.destroy()
				// Clear the owned handles only if no newer generation was wired
				// while quiescing, so an overlapping re-attach survives
				if (this._generation === generation) {
					this._discovery = undefined
					this._server = undefined
					this._state = 'initialized'
					this.logger.info('Home Assistant subsystem stopped')
				}
			} catch (error) {
				// Retain the handles and surface a failed state on a rejected
				// destroy so a later stop can retry, unless a newer generation
				// already superseded this one
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
