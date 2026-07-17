import { serverVersion, ZwavejsServer } from '@zwave-js/server'
import type { Driver } from 'zwave-js'
import type { ZwaveConfig } from '../lib/ZwaveClient.ts'
import type { HassLogger } from './ports.ts'

/**
 * The slice of gateway configuration the `@zwave-js/server` integration reads,
 * resolved lazily on every lifecycle call so a restart with changed settings is
 * honoured with no captured snapshot. Reuses {@link ZwaveConfig} so the server
 * fields stay in sync with the client's own configuration type.
 */
export type ZwaveServerConfig = Pick<
	ZwaveConfig,
	| 'serverEnabled'
	| 'serverPort'
	| 'serverHost'
	| 'serverServiceDiscoveryDisabled'
>

/**
 * Structural shape of the logger `@zwave-js/server` accepts; kept local so the
 * manager stays decoupled from the concrete winston logger the client supplies.
 */
export interface ZwaveServerLogger {
	error(message: string | Error, error?: Error): void
	warn(message: string): void
	info(message: string): void
	debug(message: string): void
}

/**
 * Host port the {@link ZwaveServerManager} uses to reach back into the owning
 * `ZwaveClient` without importing it, so there is no circular dependency. Every
 * accessor resolves the current value, so a driver/config swap on restart is
 * picked up with nothing captured at construction time.
 */
export interface ZwaveServerHost {
	/**
	 * The current driver. The server is created after the driver in `connect()`,
	 * so this is populated by the time {@link ZwaveServerManager.create} runs;
	 * typed non-null to match the client's own `_driver` field.
	 */
	getDriver(): Driver
	getConfig(): ZwaveServerConfig
	/**
	 * Whether UI inclusion callbacks are active; drives `start(!hasUserCallbacks)`
	 * so the server only owns the inclusion flow when no UI client is connected.
	 */
	getHasUserCallbacks(): boolean
	/** Invoked when the server emits `hard reset` (re-runs client `init()`). */
	onHardReset(): void
	readonly logger: HassLogger
	/** Logger handed to the `@zwave-js/server` instance itself. */
	readonly serverLogger: ZwaveServerLogger
}

/**
 * Owns the official `@zwave-js/server` (`ZwavejsServer`) instance lifecycle -
 * create after the driver, start once ready, destroy before the driver. The
 * manager holds no other client state, so a `ZwaveClient` owns exactly one and
 * delegates to it while remaining the public facade.
 */
export default class ZwaveServerManager {
	private _server: ZwavejsServer | null = null
	private readonly host: ZwaveServerHost

	// Scope each `destroy()` to one upstream `server.destroy()` per captured
	// instance: concurrent calls for the same server share this promise, while a
	// call after the instance was replaced starts a fresh teardown
	private destroyInFlight: Promise<void> | undefined
	private destroying: ZwavejsServer | null = null

	public constructor(host: ZwaveServerHost) {
		this.host = host
	}

	public get server(): ZwavejsServer | null {
		return this._server
	}

	/**
	 * Direct setter so the owning client can expose a compatible `server`
	 * accessor; some call sites force the instance to a stub or `null`.
	 */
	public set server(value: ZwavejsServer | null) {
		this._server = value
	}

	/** The upstream `@zwave-js/server` package version */
	public get version(): string {
		return serverVersion
	}

	/** Construct the `ZwavejsServer` and wire its `error`/`hard reset` listeners */
	public create(): void {
		const cfg = this.host.getConfig()
		this._server = new ZwavejsServer(this.host.getDriver(), {
			port: cfg.serverPort || 3000,
			host: cfg.serverHost,
			logger: this.host.serverLogger,
			enableDNSServiceDiscovery: !cfg.serverServiceDiscoveryDisabled,
		})

		this._server.on('error', () => {
			// this is already logged by the server but we need this to prevent
			// unhandled exceptions
		})

		this._server.on('hard reset', () => {
			this.host.logger.info('Hard reset requested by ZwaveJS Server')
			this.host.onHardReset()
		})
	}

	/**
	 * Start the server once the driver is ready and nodes are restored. The
	 * `!this._server['server']` guard prevents a second `start()` when the
	 * driver re-emits `driver ready` (see #602).
	 */
	public startIfNeeded(): void {
		if (this.host.getConfig().serverEnabled && this._server) {
			// fix prevent to start server when already inited
			if (!this._server['server']) {
				this._server
					.start(!this.host.getHasUserCallbacks())
					.then(() => {
						this.host.logger.info('Z-Wave server started')
					})
					.catch((error) => {
						this.host.logger.error(
							`Failed to start zwave-js server: ${error.message}`,
						)
					})
			}
		}
	}

	/**
	 * Tear down the server, awaiting `destroy()` so the caller can guarantee the
	 * server is gone before it destroys the driver; a no-op when none was ever
	 * created.
	 *
	 * Concurrent `destroy()` calls for the same captured server share one
	 * in-flight teardown, so the upstream `server.destroy()` runs once. The
	 * reference is cleared only if the destroyed instance is still current, so a
	 * replacement created while an older destroy runs survives; a rejected
	 * destroy leaves the reference intact (retryable) and propagates.
	 */
	public async destroy(): Promise<void> {
		const server = this._server
		if (!server) return

		if (this.destroyInFlight && this.destroying === server) {
			return this.destroyInFlight
		}

		this.destroying = server
		const run = (async () => {
			try {
				await server.destroy()
				if (this._server === server) {
					this._server = null
				}
			} finally {
				// Release the guard only if this captured server is still the one
				// being destroyed, so a replacement destroy started while this ran
				// keeps its own guard. Identity is used rather than the promise so
				// the guard needn't reference `run` inside its own initializer
				if (this.destroying === server) {
					this.destroyInFlight = undefined
					this.destroying = null
				}
			}
		})()
		this.destroyInFlight = run
		return run
	}

	/**
	 * Hand inclusion control back to the server when the last UI client
	 * disconnects; a no-op until the server has accepted a socket (`sockets` is
	 * undefined before `start()`).
	 */
	public handInclusionControlBack(): void {
		if (this._server?.['sockets'] !== undefined) {
			this._server.setInclusionUserCallbacks()
		}
	}
}
