import type { Router } from 'express'
import express from 'express'
import path from 'node:path'
import { readdir, readFile, stat } from 'node:fs/promises'
import type { Server as SocketServer } from 'socket.io'
import { Driver } from 'zwave-js'
import type { GatewayConfig } from '../lib/Gateway.ts'
import Gateway from '../lib/Gateway.ts'
import type { MqttConfig } from '../lib/MqttClient.ts'
import MqttClient from '../lib/MqttClient.ts'
import type { ZwaveConfig } from '../lib/ZwaveClient.ts'
import ZWaveClient from '../lib/ZwaveClient.ts'
import type { ZnifferConfig } from '../lib/ZnifferManager.ts'
import ZnifferManager from '../lib/ZnifferManager.ts'
import type { CustomPlugin, PluginConstructor } from '../lib/CustomPlugin.ts'
import { createPlugin } from '../lib/CustomPlugin.ts'
import backupManager from '../lib/BackupManager.ts'
import debugManager from '../lib/DebugManager.ts'
import jsonStore from '../lib/jsonStore.ts'
import store from '../config/store.ts'
import type { PersistedSettings } from '../config/store.ts'
import * as loggers from '../lib/logger.ts'
import * as utils from '../lib/utils.ts'
import { snippetsDir } from '../config/app.ts'

const logger = loggers.module('Runtime')

/**
 * Whether authentication is currently enabled, per the persisted settings.
 *
 * Pure read-through of `jsonStore`/`store` (both already stable, always
 * "live" singletons - `jsonStore.get()` never returns a stale snapshot), so
 * this doesn't need to be an `AppRuntime` instance method: there is no
 * separate "current" state to resolve here beyond what `jsonStore` itself
 * already tracks. Exported standalone (rather than nested inside
 * `api/routes/auth.ts`, which needs it too) so `AppRuntime` itself can also
 * call it - during `startGateway()`'s `SESSION_SECRET` check - without a
 * runtime-depends-on-routes import.
 */
export function isAuthEnabled(): boolean {
	return jsonStore.get(store.settings).gateway?.authEnabled === true
}

/**
 * Minimal shape shared by the collaborators `AppRuntime` starts/stops across
 * the process's lifetime (`Gateway`, `ZnifferManager` both structurally
 * satisfy this). Not load-bearing for behavior - `AppRuntime` still calls
 * each collaborator's own concrete methods directly, since their real
 * signatures/semantics differ - this only documents "these are the things
 * with a start/stop lifecycle `AppRuntime` coordinates" and gives the
 * shutdown helper below a single, honest type to accept.
 */
export interface ManagedService {
	close(): Promise<void>
}

export interface AppRuntimeDeps {
	/**
	 * Resolves the live Socket.IO server bound by `setupSocket()`
	 * (`socketManager.bindServer()`). This is a getter - not the `SocketServer`
	 * itself - because `AppRuntime` is constructed once at module load,
	 * before `startServer()` has bound Socket.IO to an HTTP server; by the
	 * time `startGateway()`/`startZniffer()` actually run (after
	 * `setupSocket(server)` in `startServer()`), the getter resolves to a
	 * real, bound server.
	 */
	getSocketServer(): SocketServer
}

/**
 * Owns every backend collaborator whose identity/presence changes across
 * the process's lifetime - the live `Gateway`, the live `ZnifferManager`,
 * the dynamically-loaded plugin instances and their mount router, the
 * in-progress-restart flag, and the (test-replaceable) serial-port
 * enumerator - plus read-through access to the backup/debug manager
 * singletons, persisted settings, and bootstrapped snippets.
 *
 * Every accessor resolves the CURRENT value on each call - nothing is
 * captured once and cached - so a gateway/zniffer replaced mid-restart (or
 * reset by a test via the harness's `__testHooks`) is immediately visible
 * to the very next call, from any consumer (HTTP route handler, Socket.IO
 * handler, etc.), without needing to reconstruct or re-fetch the runtime
 * itself. See `test/runtime/AppRuntime.test.ts`'s "a later call observes a
 * replaced gateway" regression, and the equivalent HTTP-level regression in
 * `test/lib/http/settings.test.ts`.
 */
export class AppRuntime {
	private gateway?: Gateway
	private zniffer?: ZnifferManager
	private pluginsRouter?: Router
	private plugins: CustomPlugin[] = []
	private restarting = false

	// Indirection around `Driver.enumerateSerialPorts` (real local/mDNS
	// enumeration) so `GET /api/serial-ports` can have its collaborator
	// replaced with a deterministic fake in tests, without ever touching
	// real serial hardware or the network. Production always uses the real
	// implementation; only the test-only seam ever replaces it.
	private enumerateSerialPortsFn: typeof Driver.enumerateSerialPorts =
		Driver.enumerateSerialPorts.bind(Driver)
	// Tracks whether `enumerateSerialPortsFn` currently points at the real
	// production collaborator (true) or a test-injected fake (false). Only
	// read by the `__testHooks` observability seam in `api/app.ts` -
	// production never consults it.
	private enumerateSerialPortsIsProductionDefault = true

	private defaultSnippets: utils.Snippet[] = []

	// Ownership token passed to `backupManager.init()`/`close()` so a stale
	// restart cycle can never tear down a fresh session's cron jobs - see
	// `BackupManager.ts`'s own `init`/`close` doc comments.
	private readonly backupManagerOwner = Symbol()

	// Tracks whether THIS runtime instance is the one that started the
	// currently-active debug session (as opposed to `debugManager.
	// isSessionActive()`, which only says a session is active, not who
	// started it) - so `shutdown()` only ever cancels a session it owns.
	private ownsDebugSession = false

	private readonly deps: AppRuntimeDeps

	constructor(deps: AppRuntimeDeps) {
		this.deps = deps
	}

	// ### Gateway ###

	getGateway(): Gateway | undefined {
		return this.gateway
	}

	setGateway(value: Gateway | undefined): void {
		this.gateway = value
	}

	/**
	 * Returns the current gateway WITHOUT guarding against it being absent.
	 *
	 * This is a narrow, deliberate, single-purpose exception to "no
	 * non-null assertions": several routes/helpers (configuration
	 * templates, config import/export, the store snippet listing, the
	 * restart flow, starting a debug session) have always read `gw.zwave`/
	 * `gw.close()`/etc. with no presence guard on `gw` itself, so that a
	 * request/call made with no gateway attached surfaces as a bare
	 * `TypeError: Cannot read properties of undefined (reading '...')`
	 * (caught by each route's own try/catch and reported as a generic
	 * failure), not a friendlier guarded message. This is a pinned,
	 * intentional quirk - see issue #4722's preserved-quirk ledger and
	 * `test/lib/http/{importExport,configurationTemplates,store,
	 * settings}.test.ts` for the exact characterized behavior.
	 *
	 * Honestly typing `gateway` as `Gateway | undefined` (required to fix
	 * the pre-existing `let gw: Gateway` unsound declaration this replaces)
	 * makes every one of those call sites a real strict-mode error unless
	 * *something* bridges the gap - and neither a type guard (which would
	 * turn the throw into a different code path, changing behavior) nor a
	 * `@ts-expect-error` comment (which would itself become a "Unused
	 * directive" error under this repo's non-strict `tsconfig.json`, since
	 * `strictNullChecks` is off there) can do that without changing
	 * observable behavior. A single, centralized, heavily-documented
	 * non-null assertion here - instead of one at every call site - is the
	 * narrowest available tool that preserves the exact native error call
	 * site to call site. Callers of this method must NOT add their own
	 * presence guard before using the result; that would defeat the quirk
	 * (and the tests pinning it).
	 *
	 * The assertion itself is a type-level no-op under this repo's current
	 * non-strict `tsconfig.json` (nothing to assert away when
	 * `strictNullChecks` is off), which is also why ESLint's
	 * `@typescript-eslint/no-unnecessary-type-assertion` flags it - see the
	 * inline `eslint-disable` below. It's kept anyway so this method (and
	 * every call site relying on it) is already strict-mode clean ahead of
	 * a later layer enabling `strict: true`.
	 */
	requireGateway(): Gateway {
		// The single, centralized non-null assertion described above -
		// see the docstring for why it's kept despite being a no-op under
		// this repo's current non-strict settings.
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- intentional, see doc comment above; a no-op only because this repo's tsconfig.json keeps `strict` off for now
		return this.gateway!
	}

	// ### Zniffer ###

	getZniffer(): ZnifferManager | undefined {
		return this.zniffer
	}

	setZniffer(value: ZnifferManager | undefined): void {
		this.zniffer = value
	}

	/**
	 * Returns the current zniffer WITHOUT guarding against it being absent.
	 *
	 * Same narrow, deliberate exception as `requireGateway()` above: the
	 * zniffer socket API handler has always called `zniffer.start()`/
	 * `.stop()`/etc. with no presence guard, so a call made with no
	 * zniffer configured surfaces as a bare `TypeError` (caught by the
	 * handler's own try/catch), not a friendlier guarded message. Callers
	 * must NOT add their own presence guard before using the result.
	 */
	requireZniffer(): ZnifferManager {
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- intentional, see requireGateway() above; a no-op only because this repo's tsconfig.json keeps `strict` off for now
		return this.zniffer!
	}

	// ### Plugins / plugin router ###

	getPluginsRouter(): Router | undefined {
		return this.pluginsRouter
	}

	setPluginsRouter(value: Router | undefined): void {
		this.pluginsRouter = value
	}

	getPlugins(): readonly CustomPlugin[] {
		return this.plugins
	}

	// ### Restart state ###

	isRestarting(): boolean {
		return this.restarting
	}

	setRestarting(value: boolean): void {
		this.restarting = value
	}

	// ### Debug session ownership ###

	isOwningDebugSession(): boolean {
		return this.ownsDebugSession
	}

	setOwnsDebugSession(value: boolean): void {
		this.ownsDebugSession = value
	}

	// ### Serial port enumerator ###

	getEnumerateSerialPorts(): typeof Driver.enumerateSerialPorts {
		return this.enumerateSerialPortsFn
	}

	/**
	 * Replaces the collaborator `GET /api/serial-ports` calls to enumerate
	 * local/mDNS-remote serial ports. Passing `undefined` restores the real
	 * production `Driver.enumerateSerialPorts` implementation.
	 */
	setEnumerateSerialPorts(
		value: typeof Driver.enumerateSerialPorts | undefined,
	): void {
		if (value === undefined) {
			this.enumerateSerialPortsFn =
				Driver.enumerateSerialPorts.bind(Driver)
			this.enumerateSerialPortsIsProductionDefault = true
		} else {
			this.enumerateSerialPortsFn = value
			this.enumerateSerialPortsIsProductionDefault = false
		}
	}

	isEnumerateSerialPortsProductionDefault(): boolean {
		return this.enumerateSerialPortsIsProductionDefault
	}

	// ### Backup / debug managers ###
	//
	// Both are stable-identity singletons (never replaced/swapped, unlike
	// the gateway/zniffer above) - these accessors exist so routes reach
	// them through the same single seam as everything else `AppRuntime`
	// owns, rather than importing the module-level singletons directly.

	getBackupManager(): typeof backupManager {
		return backupManager
	}

	getDebugManager(): typeof debugManager {
		return debugManager
	}

	// ### Settings ###

	getSettings(): PersistedSettings {
		return jsonStore.get(store.settings)
	}

	// ### Snippets ###

	/**
	 * Idempotent by construction: clears `defaultSnippets` before
	 * repopulating, so calling this more than once (e.g. an HTTP test
	 * harness invoking the `__testHooks` seam for more than one suite
	 * sharing this module's cache) can never duplicate entries. Production
	 * only ever calls this once, at startup, so this is purely defensive.
	 */
	async loadSnippets(): Promise<void> {
		this.defaultSnippets.length = 0
		const localSnippetsDir = utils.joinPath(false, 'snippets')
		await utils.ensureDir(snippetsDir)

		const files = await readdir(localSnippetsDir)
		for (const file of files) {
			const filePath = path.join(localSnippetsDir, file)

			if (await isSnippetFile(filePath)) {
				const content = await readFile(filePath, 'utf8')
				const name = path.basename(filePath, '.js')
				this.defaultSnippets.push({ name, content })
			}
		}
	}

	async getSnippets(): Promise<utils.Snippet[]> {
		const files = await readdir(snippetsDir)
		const snippets: utils.Snippet[] = []
		for (const file of files) {
			const filePath = path.join(snippetsDir, file)

			if (await isSnippetFile(filePath)) {
				snippets.push({
					name: file.replace('.js', ''),
					content: await readFile(filePath, 'utf8'),
				})
			}
		}

		const snippetsCache = this.gateway?.zwave?.cacheSnippets ?? []
		return [...snippetsCache, ...this.defaultSnippets, ...snippets]
	}

	// ### Startup / shutdown coordination ###

	setupLogging(
		settings: { gateway?: utils.DeepPartial<GatewayConfig> } | undefined,
	): void {
		// Original: `settings ? settings.gateway : null`. `setupAll`'s `config`
		// param has no `| undefined`/`| null` in its own declared type, but
		// `sanitizedConfig()` (which it delegates to) normalizes any falsy
		// value - `null`, `undefined`, or `{}` - identically via
		// `config || ({} as LoggerConfig)`, so falling back to `{}` here has
		// the exact same effect at runtime as the original's `null`.
		loggers.setupAll(settings?.gateway ?? {})
	}

	async startGateway(settings: PersistedSettings): Promise<void> {
		// Definite assignment assertions (`!`), not non-null assertions - these
		// mirror `SocketManager.ts`'s pre-existing `io!: SocketServer` pattern:
		// each is assigned conditionally just below (only when
		// `settings.mqtt`/`settings.zwave` is present) and then passed on to
		// `backupManager.init`/`Gateway`'s constructor/`PluginContext`, all of
		// which are themselves typed as requiring an always-present
		// `MqttClient`/`ZwaveClient` (see the comment below). Declaring these
		// as `MqttClient | undefined` instead would only push the same
		// already-tolerated mismatch to three separate call sites below
		// instead of one declaration.
		let mqtt!: MqttClient
		let zwave!: ZWaveClient

		if (isAuthEnabled() && !process.env.SESSION_SECRET) {
			logger.warn(
				'SESSION_SECRET env var is not set; using an auto-generated secret persisted in the store. ' +
					'Set SESSION_SECRET explicitly to control the secret across environments.',
			)
		}

		if (settings.mqtt) {
			// Narrow, documented boundary: `settings.mqtt` is a `DeepPartial
			// <MqttConfig>` here (whatever subset was actually persisted), but
			// `MqttClient`'s constructor is typed against the fully-populated
			// `MqttConfig` it's actually written against. In practice the
			// frontend always saves a complete `mqtt` section (never a sparse
			// partial), so this holds at runtime; this cast documents that
			// assumption instead of asserting it three-plus call sites up via
			// a blanket `as Settings`. No new validation is added.
			mqtt = new MqttClient(settings.mqtt as MqttConfig)
		}

		if (settings.zwave) {
			// Same boundary as `settings.mqtt` above, for `ZwaveConfig`.
			zwave = new ZWaveClient(
				settings.zwave as ZwaveConfig,
				this.deps.getSocketServer(),
			)
		}

		// Same boundary as `settings.mqtt`/`settings.zwave` above: `zwave`/
		// `mqtt` are declared `ZWaveClient`/`MqttClient` (not `| undefined`)
		// above so every other use below type-checks against their real,
		// fully-populated constructor parameter types; they may genuinely be
		// `undefined` here if `settings.zwave`/`settings.mqtt` was falsy.
		// `BackupManager.init`/`Gateway`'s constructor/`PluginContext` are
		// themselves typed as always requiring a `ZwaveClient`/`MqttClient` -
		// tightening that (out of scope here, and true of `Gateway`'s own
		// `zwave`/`mqtt` getters too) would be a `BackupManager.ts`/
		// `Gateway.ts`/`CustomPlugin.ts` change, not part of this layer.
		// Passing possibly-`undefined` values through this pre-existing,
		// tolerated mismatch is intentional, preserved behavior, not new.
		backupManager.init(zwave, this.backupManagerOwner)

		// Unlike `mqtt`/`zwave`, `Gateway` is always constructed (even when
		// `settings.gateway` itself is `undefined`) - `GatewayConfig |
		// undefined` is what `Gateway`'s constructor already accepts.
		const gw = new Gateway(settings.gateway as GatewayConfig, zwave, mqtt)
		this.setGateway(gw)

		await gw.start()

		const pluginsConfig = settings.gateway?.plugins ?? null
		const pluginsRouter = express.Router()
		this.setPluginsRouter(pluginsRouter)

		// load custom plugins
		if (pluginsConfig && Array.isArray(pluginsConfig)) {
			for (const plugin of pluginsConfig) {
				try {
					const pluginName = path.basename(plugin)
					const pluginsContext = {
						zwave,
						mqtt,
						app: pluginsRouter,
						logger: loggers.module(pluginName),
					}
					const constructor = (await import(plugin))
						.default as PluginConstructor
					const instance = createPlugin(
						constructor,
						pluginsContext,
						pluginName,
					)

					this.plugins.push(instance)
					logger.info(`Successfully loaded plugin ${instance.name}`)
				} catch (error) {
					logger.error(`Error while loading ${plugin} plugin`, error)
				}
			}
		}

		this.setRestarting(false)
	}

	startZniffer(settings: utils.DeepPartial<ZnifferConfig> | undefined): void {
		if (settings) {
			// Same documented boundary as `startGateway`'s MqttClient/Gateway/
			// ZWaveClient construction: `settings` here is whatever (possibly
			// sparse) subset of `ZnifferConfig` was actually persisted, cast to
			// the fully-populated shape `ZnifferManager`'s constructor is
			// written against.
			this.setZniffer(
				new ZnifferManager(
					settings as ZnifferConfig,
					this.deps.getSocketServer(),
				),
			)
		}
	}

	async destroyPlugins(): Promise<void> {
		while (this.plugins.length > 0) {
			const instance = this.plugins.pop()
			if (instance && typeof instance.destroy === 'function') {
				logger.info('Closing plugin ' + instance.name)
				await instance.destroy()
			}
		}
	}

	private async closeIfPresent(
		service: ManagedService | undefined,
	): Promise<void> {
		if (service) {
			await service.close()
		}
	}

	/**
	 * Closes the current gateway/zniffer (if any), destroys any loaded
	 * plugins, and releases this instance's `backupManager` ownership -
	 * exactly the collaborator-closing portion of `close()`/
	 * `gracefuShutdown()` in `api/app.ts` (which additionally handles
	 * process-handler/log-interceptor/debug-session/socketManager
	 * teardown, none of which are `AppRuntime`'s own collaborators). Each
	 * step is independently try/caught so one failing close can't prevent
	 * the others from running, matching the pre-existing guarded
	 * `if (gw) await gw.close()` behavior this preserves.
	 */
	async shutdown(): Promise<void> {
		try {
			await this.closeIfPresent(this.gateway)
		} catch (error) {
			logger.error('Error while closing gateway', error)
		}

		try {
			await this.closeIfPresent(this.zniffer)
		} catch (error) {
			logger.error('Error while closing zniffer', error)
		}

		try {
			await this.destroyPlugins()
		} catch (error) {
			logger.error('Error while closing plugins', error)
		}

		try {
			backupManager.close(this.backupManagerOwner)
		} catch (error) {
			logger.error('Error while closing backup manager', error)
		}
	}
}

async function isSnippetFile(file: string): Promise<boolean> {
	return (await stat(file)).isFile() && file.endsWith('.js')
}
