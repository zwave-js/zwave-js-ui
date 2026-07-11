import { serverVersion, ZwavejsServer } from '@zwave-js/server'
import type { Driver } from 'zwave-js'
import type { HassLogger } from './ports.ts'

/**
 * The narrow slice of gateway configuration the official `@zwave-js/server`
 * integration reads. Resolved lazily on every lifecycle call so a restart with
 * changed settings is always honoured (no captured config snapshot).
 */
export interface ZwaveServerConfig {
	serverEnabled?: boolean
	serverPort?: number
	serverHost?: string
	serverServiceDiscoveryDisabled?: boolean
}

/**
 * Structural shape of the logger `@zwave-js/server` accepts. Kept local so the
 * manager stays decoupled from the concrete winston `ModuleLogger` the client
 * happens to supply (the client passes `LogManager.module('Z-Wave-Server')`).
 */
export interface ZwaveServerLogger {
	error(message: string | Error, error?: Error): void
	warn(message: string): void
	info(message: string): void
	debug(message: string): void
}

/**
 * Narrow host port the {@link ZwaveServerManager} uses to reach back into the
 * owning `ZwaveClient` without importing it (no circular dependency, no broad
 * casts). Every accessor resolves the CURRENT value so a driver/config swap on
 * restart is picked up — nothing is captured at construction time.
 */
export interface ZwaveServerHost {
	/**
	 * The current driver. The server is always created AFTER the driver in
	 * `connect()`, so this is populated by the time {@link ZwaveServerManager.create}
	 * runs. Typed non-null to match the client's own `_driver` field.
	 */
	getDriver(): Driver
	/** The current server-related configuration. */
	getConfig(): ZwaveServerConfig
	/**
	 * Whether inbound user (UI) inclusion callbacks are active. Drives
	 * `start(!hasUserCallbacks)` so the server only owns the inclusion flow
	 * when no UI client is connected.
	 */
	getHasUserCallbacks(): boolean
	/** Invoked when the server emits `hard reset` (re-runs client `init()`). */
	onHardReset(): void
	/** Application logger for lifecycle info/error messages. */
	readonly logger: HassLogger
	/** Logger handed to the `@zwave-js/server` instance itself. */
	readonly serverLogger: ZwaveServerLogger
}

/**
 * Owns the official `@zwave-js/server` (`ZwavejsServer`) instance lifecycle
 * that used to live inline in `ZwaveClient`. Extracted verbatim so behaviour is
 * unchanged:
 *
 *  - {@link create} builds the server right after the driver is created (only
 *    when `serverEnabled`), defaulting the port to 3000, mapping `serverHost`
 *    to `host` and inverting `serverServiceDiscoveryDisabled` into
 *    `enableDNSServiceDiscovery`, and wires the `error` (swallow) and
 *    `hard reset` (re-init) listeners.
 *  - {@link startIfNeeded} starts the server once the driver is ready, guarded
 *    by `serverEnabled`, an existing instance and the `!server['server']`
 *    duplicate-start guard that survives a re-emitted `driver ready` (#602),
 *    passing `start(!hasUserCallbacks)`.
 *  - {@link destroy} awaits `server.destroy()` and nulls the reference so the
 *    driver teardown can safely await the server shutting down first.
 *
 * The manager holds NO other client state, so a `ZwaveClient` can own exactly
 * one and delegate to it while remaining the public facade.
 */
export default class ZwaveServerManager {
	private _server: ZwavejsServer | null = null
	private readonly host: ZwaveServerHost

	public constructor(host: ZwaveServerHost) {
		this.host = host
	}

	/** The live server instance, or `null` when none is running. */
	public get server(): ZwavejsServer | null {
		return this._server
	}

	/**
	 * Direct setter kept so the owning client can expose a compatible
	 * `server` accessor (some call sites force the instance to a stub/`null`).
	 */
	public set server(value: ZwavejsServer | null) {
		this._server = value
	}

	/** The upstream `@zwave-js/server` package version. */
	public get version(): string {
		return serverVersion
	}

	/**
	 * Construct the `ZwavejsServer` and wire its `error`/`hard reset`
	 * listeners. Mirrors the former `ZwaveClient._createServer()` exactly.
	 */
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
	 * driver re-emits `driver ready` (see #602). Mirrors the former
	 * `ZwaveClient._startServerIfNeeded()` exactly.
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
	 * Tear down the server, awaiting `destroy()` so the caller can guarantee
	 * the server is gone before it destroys the driver. Idempotent: a no-op
	 * when no server was ever created.
	 */
	public async destroy(): Promise<void> {
		if (this._server) {
			await this._server.destroy()
			this._server = null
		}
	}

	/**
	 * When the last UI client disconnects, hand inclusion control back to the
	 * server so it can drive the flow. No-op until the server has actually
	 * accepted a socket (`sockets` is undefined before `start()`).
	 */
	public handInclusionControlBack(): void {
		if (this._server?.['sockets'] !== undefined) {
			this._server.setInclusionUserCallbacks()
		}
	}
}
