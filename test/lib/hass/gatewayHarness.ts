/**
 * Real-`Gateway` + real-`MqttClient` harness for the HASS discovery
 * characterization tests.
 *
 * Unlike the transport suites (which fake `Gateway`), this harness
 * constructs the REAL `api/lib/Gateway.ts` and the REAL
 * `api/lib/MqttClient.ts` - only the upstream `mqtt` package is replaced (via
 * the caller's `vi.mock('mqtt', ...)`, see `mqttMock.ts`). Discovery methods
 * are then invoked directly on the real `Gateway` (`discoverValue`,
 * `discoverDevice`, `discoverClimates`, `publishDiscovery`, ...), so every
 * produced topic/payload/QoS/retain flag is the exact output of production
 * code, captured at the `broker.publish(...)` boundary.
 *
 * The dynamic `import()` of `Gateway.ts`/`MqttClient.ts` happens strictly
 * AFTER `ensureTestEnv()` (see `env.ts`) so their module-level `storeDir`
 * capture / `customDevices` watcher install target this file's throwaway
 * directory, never the real `store/`.
 *
 * The real `gw.start()` IS awaited: it initializes the internal
 * `discovered`/`topicValues`/`topicLevels` maps AND wires the real MQTT event
 * handlers (`writeRequest`/`hassStatus`/`brokerStatus`/...), so lifecycle
 * tests can drive `broker.deliver('homeassistant/status', ...)` through the
 * genuine `MqttClient` -> `Gateway` path. `start()` also `await`s
 * `zwave.connect()`, which is a harmless `vi.fn()` on the fake collaborator
 * (no real driver bring-up). The fake `zwave` is a real `EventEmitter`, so the
 * zwave-side listeners `start()` registers (`nodeInited`/`valueChanged`/...)
 * are genuinely wired: a test can `zwave.emit('nodeInited', node)` to drive
 * the real `Gateway._onNodeInited` discovery pipeline end to end.
 */
import type GatewayType from '../../../api/lib/Gateway.ts'
import type { GatewayConfig } from '../../../api/lib/Gateway.ts'
import type MqttClientType from '../../../api/lib/MqttClient.ts'
import type { MqttConfig } from '../../../api/lib/MqttClient.ts'
import type { HassDevice } from '../../../api/lib/ZwaveClient.ts'
import { ensureTestEnv, cleanupTestEnv } from './env.ts'
import { latestBroker, type FakeBroker } from './mqttMock.ts'
import {
	defaultMqttConfig,
	createFakeGatewayZwave,
	type FakeGatewayZwave,
} from './fixtures.ts'

/** `Gateway`'s numeric gateway-type discriminants (mirrors `Gateway.ts`). */
export const GATEWAY_TYPE = {
	VALUEID: 0,
	NAMED: 1,
	MANUAL: 2,
} as const

/** A single published discovery packet, decoded from the broker record. */
export interface PublishedDiscovery {
	/** Full topic including the discovery prefix (e.g. `homeassistant/...`). */
	topic: string
	/** Parsed JSON payload, or the raw string for a delete (empty payload). */
	payload: any
	options: Record<string, any> | undefined
}

export interface GatewayHarness {
	gw: GatewayType
	mqtt: MqttClientType
	zwave: FakeGatewayZwave
	broker: FakeBroker
	/**
	 * The live `GatewayConfig` object (same reference the `Gateway` holds), so
	 * tests can characterize value-configuration plumbing (e.g. push a
	 * `config.values` entry to exercise `valueConf`/`ccConfigEnableDiscovery`)
	 * and restore it afterwards.
	 */
	config: GatewayConfig
	/** Every discovery packet published so far, decoded and in call order. */
	publishedDiscoveries(): PublishedDiscovery[]
	/** The single most recent published discovery packet. */
	lastDiscovery(): PublishedDiscovery
	/** Clears the broker's recorded publishes (per-test reset). */
	resetPublishes(): void
	/**
	 * Per-test reset: clears recorded publishes AND the gateway's internal
	 * `discovered` de-dup map, so a fresh node reusing an earlier value id is
	 * not silently skipped by the `discovered[valueId.id]` guard. Does NOT
	 * touch the isolated env (that survives for the whole file).
	 */
	resetState(): void
	/**
	 * Releases this harness's own resources (MQTT client + the Gateway
	 * module's `customDevices` watchers). Safe to call more than once. Does
	 * NOT remove the shared isolated `STORE_DIR` - call
	 * `cleanupGatewayHarnessEnv()` exactly once per file (final `afterAll`)
	 * for that, so files that build more than one harness don't delete a
	 * directory `api/config/app.ts` already captured.
	 */
	close(): Promise<void>
}

export interface GatewayHarnessOptions {
	/** Extra `GatewayConfig` fields, merged over the faithful defaults. */
	config?: Partial<GatewayConfig>
	/** Extra `MqttConfig` fields. */
	mqttConfig?: Partial<MqttConfig>
	/** Overrides for the fake `zwave` collaborator (e.g. `homeHex`). */
	zwave?: Partial<FakeGatewayZwave>
}

/**
 * Builds a real `Gateway` wired to a real `MqttClient` (backed by the mocked
 * `mqtt` broker) and a fake `zwave` collaborator. Defaults model a typical
 * production HASS deployment: `NAMED` gateway type, `hassDiscovery: true`,
 * discovery prefix `homeassistant`.
 */
export async function createGatewayHarness(
	options: GatewayHarnessOptions = {},
): Promise<GatewayHarness> {
	ensureTestEnv()

	const [{ default: Gateway, closeWatchers }, { default: MqttClient }] =
		await Promise.all([
			import('../../../api/lib/Gateway.ts'),
			import('../../../api/lib/MqttClient.ts'),
		])

	const mqtt = new MqttClient(defaultMqttConfig(options.mqttConfig))
	const zwave = createFakeGatewayZwave(options.zwave)

	const config: GatewayConfig = {
		type: GATEWAY_TYPE.NAMED,
		hassDiscovery: true,
		discoveryPrefix: 'homeassistant',
		...options.config,
	}

	const gw = new Gateway(config, zwave as any, mqtt)
	// Run the real start() so internal maps are initialized and the genuine
	// MQTT/zwave event handlers are wired. `zwave.connect()` is a fake spy, so
	// no real driver is started.
	await gw.start()

	const broker = latestBroker()

	function publishedDiscoveries(): PublishedDiscovery[] {
		return broker.published.map((p) => {
			let payload: any = p.payload
			if (typeof payload === 'string' && payload.length > 0) {
				try {
					payload = JSON.parse(payload)
				} catch {
					// leave as raw string
				}
			}
			return { topic: p.topic, payload, options: p.options }
		})
	}

	return {
		gw,
		mqtt,
		zwave,
		broker,
		config,
		publishedDiscoveries,
		lastDiscovery() {
			const all = publishedDiscoveries()
			if (all.length === 0) {
				throw new Error('No discovery packet published yet')
			}
			return all[all.length - 1]
		},
		resetPublishes() {
			broker.published.length = 0
		},
		resetState() {
			broker.published.length = 0
			;(gw as any).discovered = {}
			;(gw as any).topicValues = {}
		},
		async close() {
			await mqtt.close()
			closeWatchers()
		},
	}
}

/**
 * Removes the shared isolated `STORE_DIR` and restores the app env vars.
 * Call exactly once per test file (final `afterAll`), AFTER every harness in
 * the file has been `close()`d. Kept separate from `GatewayHarness.close()`
 * so a file that builds several harnesses doesn't delete the directory
 * `api/config/app.ts` captured at first import out from under the others.
 */
export function cleanupGatewayHarnessEnv(): void {
	cleanupTestEnv()
}

/**
 * Small helper: after registering a valueId on a node, invoke the real
 * `discoverValue` and return the `HassDevice` the gateway attached to the
 * node's `hassDevices` map (or `undefined` if the command class produced no
 * entity). Keeps per-family tests terse while still driving production code.
 */
export function discoverValueOnNode(
	gw: GatewayType,
	node: { hassDevices?: Record<string, HassDevice> },
	valueKey: string,
): HassDevice | undefined {
	const before = new Set(Object.keys(node.hassDevices ?? {}))
	gw.discoverValue(node as any, valueKey)
	const after = Object.entries(node.hassDevices ?? {})
	const added = after.find(([k]) => !before.has(k))
	return added?.[1]
}
