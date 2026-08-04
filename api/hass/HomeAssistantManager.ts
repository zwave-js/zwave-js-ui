import { SingleFlight } from '../lib/utils.ts'
import type { HassLogger } from './ports.ts'

/**
 * Control handle for the discovery subsystem the coordinator owns; exposes only
 * `stop()` because discovery start stays locked to `Gateway.start()` on the
 * instance the coordinator holds. `stop()` is a synchronous halt (no port to
 * await); the server's `destroy()` below is the awaited release, which is why
 * the two verbs differ.
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
 * The discovery + `@zwave-js/server` handles the clients constructed and own,
 * handed to the coordinator for one gateway generation. `server` is `undefined`
 * when the generation has no Z-Wave client.
 */
export interface HomeAssistantGeneration {
	discovery: HassManagedDiscovery
	server: HassManagedServer | undefined
}

export interface HomeAssistantManagerOptions {
	logger: HassLogger
}

/**
 * The single, process-lifetime owner of the built-in Home Assistant subsystem.
 * It holds the current generation's discovery and `@zwave-js/server` handles
 * (constructed and owned by the clients, adopted here through
 * {@link attachClients}) and drives their ordered, idempotent teardown.
 *
 * Discovery/server start stays locked to `Gateway.start()` and the driver
 * points, since the clients drive the very instances this manager holds. The
 * only guarantee callers actually need is an idempotent, retryable {@link stop}
 * that halts discovery before the server is released; a restart attaches a
 * fresh generation after the previous one has been stopped.
 */
export default class HomeAssistantManager {
	private readonly logger: HassLogger
	private _initialized = false
	private _discovery: HassManagedDiscovery | undefined
	private _server: HassManagedServer | undefined
	private readonly stopFlight = new SingleFlight()

	public constructor(options: HomeAssistantManagerOptions) {
		this.logger = options.logger
	}

	/** Take ownership before any client is constructed; logs once, idempotent so a restart re-entering is a no-op */
	public initialize(): void {
		if (this._initialized) return
		this._initialized = true
		this.logger.info('Home Assistant subsystem initialized')
	}

	/**
	 * Adopt a fresh generation's discovery + server handles, after the new
	 * clients exist but before they start, so the clients drive the instances
	 * this manager owns at their locked timing points.
	 *
	 * Requires a clean slate: every production caller stops the previous
	 * generation before re-attaching (boot attaches once; a restart tears down
	 * before it starts). A lingering handle therefore means a caller closed the
	 * clients out of order, so this refuses rather than silently dropping — and
	 * leaking — the previous discovery/server.
	 */
	public attachClients(generation: HomeAssistantGeneration): void {
		this.initialize()
		if (this._discovery || this._server) {
			throw new Error(
				'Home Assistant subsystem still owns a generation; stop it before attaching a new one',
			)
		}
		this._discovery = generation.discovery
		this._server = generation.server
		this.logger.info('Home Assistant subsystem attached')
	}

	/** Confirm the current generation is up, once `Gateway.start()` has started discovery and the server */
	public start(): void {
		if (!this._discovery) return
		this.logger.info(
			`Home Assistant subsystem started (server: ${
				this._server ? this._server.version : 'inactive'
			})`,
		)
	}

	/**
	 * Quiesce the current generation before the clients close: halt discovery,
	 * then await the `@zwave-js/server` destroy so the server's port is released
	 * before the driver is destroyed downstream.
	 *
	 * The two steps are isolated so a discovery failure cannot skip the server
	 * destroy, and both failures are aggregated rather than the first aborting
	 * the sequence. Idempotent and single-flight: concurrent/repeat calls share
	 * one in-flight teardown. A successful stop clears the handles, so a later
	 * stop is a clean no-op; a failed stop retains them (retryable), logs at
	 * `warn`, and rethrows the first error.
	 */
	public async stop(): Promise<void> {
		const discovery = this._discovery
		const server = this._server
		if (!discovery && !server) return

		return this.stopFlight.run(async () => {
			this.logger.info('Stopping Home Assistant subsystem')
			const errors: unknown[] = []

			try {
				// Drop the discovery fence first so no producer/subscription
				// survives the server release
				discovery?.stop()
			} catch (error) {
				errors.push(error)
			}

			try {
				// Await the server destroy so its port is gone before the driver
				// is destroyed downstream
				await server?.destroy()
			} catch (error) {
				errors.push(error)
			}

			if (errors.length > 0) {
				// Retain the handles so a later stop retries; surface the first
				this.logger.warn(
					'Home Assistant subsystem stop failed; retained for retry',
					errors[0],
				)
				throw errors[0]
			}

			this._discovery = undefined
			this._server = undefined
			this.logger.info('Home Assistant subsystem stopped')
		})
	}
}
