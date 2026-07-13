/**
 * Real-`Gateway` + real-`MqttClient` HASS discovery harness: only the upstream
 * `mqtt` package is faked (see `mqttMock.ts`), so every captured
 * topic/payload/QoS/retain is production output taken at the `broker.publish`
 * boundary. The dynamic `import()` runs after `ensureTestEnv()` so the modules'
 * `storeDir`/watcher capture targets the throwaway dir, never the real
 * `store/`. `start()` is awaited and the fake `zwave` is a real `EventEmitter`,
 * so a test can `zwave.emit(...)` to drive the real discovery pipeline.
 */
import type GatewayType from '#api/lib/Gateway.ts'
import type { GatewayConfig } from '#api/lib/Gateway.ts'
import type MqttClientType from '#api/lib/MqttClient.ts'
import type { MqttConfig } from '#api/lib/MqttClient.ts'
import type ZwaveClientType from '#api/lib/ZwaveClient.ts'
import type { HassDevice, ZUINode } from '#api/lib/ZwaveClient.ts'
import type { IClientPublishOptions } from 'mqtt'
import { ensureTestEnv, cleanupTestEnv } from './env.ts'
import { latestBroker, type FakeBroker } from './mqttMock.ts'
import {
	defaultMqttConfig,
	createFakeGatewayZwave,
	type FakeGatewayZwave,
} from './fixtures.ts'

/** Mirrors `Gateway`'s numeric gateway-type discriminants. */
export const GATEWAY_TYPE = {
	VALUEID: 0,
	NAMED: 1,
	MANUAL: 2,
} as const

export interface PublishedDiscovery {
	topic: string
	/** Parsed JSON payload, or the raw string for a delete (empty payload). */
	payload: any
	options: IClientPublishOptions | undefined
}

export interface GatewayHarness {
	gw: GatewayType
	mqtt: MqttClientType
	zwave: FakeGatewayZwave
	broker: FakeBroker
	/**
	 * Live `GatewayConfig` (same reference the `Gateway` holds) so tests can
	 * push a `config.values` entry to exercise value-config plumbing and
	 * restore it afterward.
	 */
	config: GatewayConfig
	publishedDiscoveries(): PublishedDiscovery[]
	lastDiscovery(): PublishedDiscovery
	resetPublishes(): void
	/**
	 * Clears the recorded publishes between phases of a single test. Each test
	 * builds its own harness, so the gateway's de-dup maps already start empty.
	 */
	resetState(): void
	/**
	 * Releases this harness's MQTT client and the Gateway module's
	 * `customDevices` watchers (idempotent). Does not remove the shared
	 * `STORE_DIR`; call `cleanupGatewayHarnessEnv()` once per file for that.
	 */
	close(): Promise<void>
}

export interface GatewayHarnessOptions {
	config?: Partial<GatewayConfig>
	mqttConfig?: Partial<MqttConfig>
	zwave?: Partial<FakeGatewayZwave>
}

/**
 * Builds a real `Gateway` + real `MqttClient` (backed by the mocked `mqtt`
 * broker) with defaults modeling a production HASS deployment: `NAMED` type,
 * `hassDiscovery: true`, prefix `homeassistant`.
 */
export async function createGatewayHarness(
	options: GatewayHarnessOptions = {},
): Promise<GatewayHarness> {
	ensureTestEnv()

	const [{ default: Gateway, closeWatchers }, { default: MqttClient }] =
		await Promise.all([
			import('#api/lib/Gateway.ts'),
			import('#api/lib/MqttClient.ts'),
		])

	const mqtt = new MqttClient(defaultMqttConfig(options.mqttConfig))
	const zwave = createFakeGatewayZwave(options.zwave)

	const config: GatewayConfig = {
		type: GATEWAY_TYPE.NAMED,
		hassDiscovery: true,
		discoveryPrefix: 'homeassistant',
		...options.config,
	}

	// The fake zwave stands in for the real client at the constructor's
	// dependency-injection boundary; it implements only what the HASS pipeline
	// touches, so narrow it to the client type here rather than app-wide
	const gw = new Gateway(config, zwave as unknown as ZwaveClientType, mqtt)
	// Real start() initializes internal maps and wires the genuine MQTT/zwave
	// handlers; zwave.connect() is a fake spy, so no real driver starts
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
		},
		async close() {
			// Drive the real Gateway.close teardown (zwave.close, cancelJobs,
			// mqtt.close) instead of closing mqtt directly; Gateway.close leaves
			// the module-global watchers, so release them separately
			await gw.close()
			closeWatchers()
		},
	}
}

/**
 * Removes the shared `STORE_DIR` and restores the app env vars. Call once per
 * file (final `afterAll`) after every harness has closed, so a multi-harness
 * file doesn't delete the directory `api/config/app.ts` captured.
 */
export function cleanupGatewayHarnessEnv(): void {
	cleanupTestEnv()
}

/**
 * Invokes the real `discoverValue` for `valueKey` and returns the `HassDevice`
 * the gateway attached to the node (or `undefined` if the command class
 * produced no entity).
 */
export function discoverValueOnNode(
	gw: GatewayType,
	node: { hassDevices?: Record<string, HassDevice> },
	valueKey: string,
): HassDevice | undefined {
	const before = new Set(Object.keys(node.hassDevices ?? {}))
	gw.discoverValue(node as unknown as ZUINode, valueKey)
	const after = Object.entries(node.hassDevices ?? {})
	const added = after.find(([k]) => !before.has(k))
	return added?.[1]
}
