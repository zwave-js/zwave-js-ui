import type { HassLogger } from './ports.ts'

/**
 * The narrow view the coordinator needs of the legacy MQTT discovery subsystem
 * (owned by the live `Gateway` via `MqttDiscoveryManager`). Kept minimal so the
 * coordinator never binds to the concrete manager and tolerates its absence.
 */
export interface HassDiscoverySubsystem {
	/** Remove the scoped HA/broker status subscription. Idempotent. */
	disposeStatus(): void
}

/**
 * The narrow view the coordinator needs of the `@zwave-js/server` subsystem
 * (owned by the live `ZwaveClient` via `ZwaveServerManager`). Teardown stays
 * owned by `ZwaveClient.close()` (awaited before the driver), so the
 * coordinator only ever reads through this facade.
 */
export interface HassServerSubsystem {
	readonly version: string
}

/**
 * Resolver bundle the coordinator uses to reach the CURRENT sub-managers on
 * every call. Each resolver reads the live gateway/client through `AppRuntime`,
 * so a gateway or Z-Wave client replaced mid-restart is observed immediately -
 * nothing is captured once and cached. Any resolver may return `undefined`
 * (no gateway yet, MQTT disabled, a mocked collaborator, a partial failure),
 * which the coordinator treats as "that subsystem is not present".
 */
export interface HomeAssistantCollaborators {
	resolveDiscovery(): HassDiscoverySubsystem | undefined
	resolveServer(): HassServerSubsystem | undefined
}

export interface HomeAssistantManagerOptions {
	logger: HassLogger
}

/**
 * `AppRuntime`-owned lifecycle coordinator for the built-in Home Assistant
 * subsystem. It does not re-implement the discovery or `@zwave-js/server`
 * lifecycles - those are owned by the live `Gateway`/`ZwaveClient` (and locked
 * to `Gateway.start()/close()` and `ZwaveClient.connect()/close()` by the
 * characterization suite). Instead this object gives the subsystem a single,
 * process-lifetime owner that:
 *
 *  - is created and {@link initialize}d BEFORE the MQTT/Z-Wave clients start,
 *  - has the live collaborators {@link bind}ed to it (as always-current
 *    resolvers, never stale captures) once the gateway exists,
 *  - is {@link start}ed after the gateway has started, and
 *  - is {@link stop}ped BEFORE the collaborators are closed, quiescing the HA
 *    status reactions so no rediscovery races the client shutdown.
 *
 * Every step is idempotent and tolerant of absent collaborators, preserving the
 * partial-failure / restart / ordering guarantees `AppRuntime` relies on. The
 * {@link discovery}/{@link server} facade getters resolve the current
 * sub-managers for any consumer.
 */
export default class HomeAssistantManager {
	private readonly logger: HassLogger
	private collaborators: HomeAssistantCollaborators | undefined
	private _initialized = false
	private _started = false

	public constructor(options: HomeAssistantManagerOptions) {
		this.logger = options.logger
	}

	/** Whether {@link initialize} has run. */
	public get initialized(): boolean {
		return this._initialized
	}

	/** Whether the subsystem is currently started. */
	public get started(): boolean {
		return this._started
	}

	/** The current legacy MQTT discovery subsystem, if any. */
	public get discovery(): HassDiscoverySubsystem | undefined {
		return this.collaborators?.resolveDiscovery()
	}

	/** The current `@zwave-js/server` subsystem, if any. */
	public get server(): HassServerSubsystem | undefined {
		return this.collaborators?.resolveServer()
	}

	/**
	 * Take ownership of the subsystem before any client starts. Idempotent: a
	 * second call (e.g. a restart) is a no-op beyond keeping ownership.
	 */
	public initialize(): void {
		if (this._initialized) return
		this._initialized = true
		this.logger.info('Home Assistant subsystem initialized')
	}

	/**
	 * Attach the live collaborators as always-current resolvers. Safe to call
	 * again to re-point at a replaced gateway/client; because the resolvers
	 * read the live collaborators on each call, the coordinator never holds a
	 * stale reference.
	 */
	public bind(collaborators: HomeAssistantCollaborators): void {
		this.collaborators = collaborators
	}

	/**
	 * Mark the subsystem active once the gateway has started. Resolves the
	 * current sub-managers so their presence is observed against the live
	 * clients (never a stale capture) and logged. Idempotent.
	 */
	public start(): void {
		if (this._started) return
		this._started = true

		const discovery = this.discovery
		const server = this.server
		this.logger.info(
			`Home Assistant subsystem started (discovery: ${
				discovery ? 'active' : 'inactive'
			}, server: ${server ? server.version : 'inactive'})`,
		)
	}

	/**
	 * Quiesce the subsystem before the collaborators are closed: dispose the
	 * current discovery status subscription so no HA/broker status transition
	 * triggers a rediscovery while the Z-Wave/MQTT clients are shutting down.
	 * The structural teardown (discovered index, catalog fork, server destroy)
	 * remains owned by `Gateway.close()`/`ZwaveClient.close()` at their exact
	 * positions. Idempotent and tolerant of an already-closed or absent
	 * subsystem.
	 */
	public stop(): void {
		if (!this._started) return
		this._started = false

		this.discovery?.disposeStatus()
		this.logger.info('Home Assistant subsystem stopped')
	}
}
