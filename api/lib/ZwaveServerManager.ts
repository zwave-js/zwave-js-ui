import { ZwavejsServer } from '@zwave-js/server'
import type { Driver } from 'zwave-js'
import type { ZwaveConfig } from './ZwaveClient.ts'
import type { ModuleLogger } from './logger.ts'
import { SingleFlight } from './utils.ts'

const DEFAULT_SERVER_PORT = 3000

/**
 * The configuration slice the `@zwave-js/server` integration reads, resolved on
 * every lifecycle call so a restart with changed settings needs no snapshot.
 */
export type ZwaveServerConfig = Pick<
	ZwaveConfig,
	| 'serverEnabled'
	| 'serverPort'
	| 'serverHost'
	| 'serverServiceDiscoveryDisabled'
>

/** The logger shape `@zwave-js/server` accepts */
export interface ZwaveServerLogger {
	error(message: string | Error, error?: Error): void
	warn(message: string): void
	info(message: string): void
	debug(message: string): void
}

/**
 * Host port the {@link ZwaveServerManager} uses to reach back into the owning
 * `ZwaveClient` without importing it. Every accessor resolves the current value,
 * so a driver/config swap on restart is picked up.
 */
export interface ZwaveServerHost {
	getDriver(): Driver
	getConfig(): ZwaveServerConfig
	/** Drives `start(!hasUserCallbacks)`, so the server owns inclusion only while no UI client is connected */
	getHasUserCallbacks(): boolean
	/** Invoked when the server emits `hard reset` */
	onHardReset(): void
	readonly logger: Pick<ModuleLogger, 'info' | 'error'>
	/** Logger handed to the `@zwave-js/server` instance itself */
	readonly serverLogger: ZwaveServerLogger
}

/**
 * Owns the `@zwave-js/server` instance lifecycle: create after the driver, start
 * once ready, destroy before the driver. A `ZwaveClient` owns exactly one and
 * delegates to it while remaining the public facade.
 */
export default class ZwaveServerManager {
	private _server: ZwavejsServer | null = null
	private readonly host: ZwaveServerHost

	// Share one upstream `destroy()` across concurrent callers; the slot is
	// released when it settles, so a later call can retry
	private readonly destroyFlight = new SingleFlight()

	public constructor(host: ZwaveServerHost) {
		this.host = host
	}

	public get server(): ZwavejsServer | null {
		return this._server
	}

	/**
	 * Construct the server and wire its listeners. Owning the `serverEnabled` gate
	 * here keeps the enablement check in one place, so `connect()` calls this
	 * unconditionally.
	 */
	public create(): void {
		const cfg = this.host.getConfig()
		if (!cfg.serverEnabled) return
		this._server = new ZwavejsServer(this.host.getDriver(), {
			port: cfg.serverPort || DEFAULT_SERVER_PORT,
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

	/** Start the server once the driver is ready and nodes are restored */
	public startIfNeeded(): void {
		if (this.host.getConfig().serverEnabled && this._server) {
			// The driver re-emits `driver ready`, so skip a second start once the
			// server holds its http server (see #602)
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
	 * Tear down the server, awaiting `destroy()` so the caller can rely on the
	 * listening port being released before it destroys the driver. A no-op when
	 * none was created; a rejected destroy keeps the reference so a later call
	 * retries.
	 */
	public async destroy(): Promise<void> {
		const server = this._server
		if (!server) return

		return this.destroyFlight.run(async () => {
			this.host.logger.info('Destroying Z-Wave server...')
			await server.destroy()
			// Clear only if this captured server is still current, so a
			// replacement created while this destroy ran is not erased
			if (this._server === server) {
				this._server = null
			}
		})
	}

	/**
	 * Hand inclusion control back to the server when the last UI client
	 * disconnects; `sockets` is undefined until `start()` accepts one.
	 */
	public handInclusionControlBack(): void {
		if (this._server?.['sockets'] !== undefined) {
			this._server.setInclusionUserCallbacks()
		}
	}
}
