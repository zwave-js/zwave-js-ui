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
import { latestBroker, resetMqttBrokers, type FakeBroker } from './mqttMock.ts'
import {
	defaultMqttConfig,
	createFakeGatewayZwave,
	type FakeGatewayZwave,
} from './fixtures.ts'
import { useManagedCurrent, type ManagedCurrent } from '../shared/harness.ts'

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
	publishedDiscoveries(): PublishedDiscovery[]
	lastDiscovery(): PublishedDiscovery
	resetPublishes(): void
	/**
	 * Releases this harness's MQTT client and the Gateway module's
	 * `customDevices` watchers (idempotent). Per-file `STORE_DIR` removal is
	 * handled by `useGatewayHarness()`'s `afterAll`.
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

	const [
		{ default: Gateway, closeWatchers, GatewayType },
		{ default: MqttClient },
	] = await Promise.all([
		import('#api/lib/Gateway.ts'),
		import('#api/lib/MqttClient.ts'),
	])

	const mqtt = new MqttClient(defaultMqttConfig(options.mqttConfig))
	const zwave = createFakeGatewayZwave(options.zwave)

	const config: GatewayConfig = {
		type: GatewayType.NAMED,
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
		async close() {
			// Drive the real Gateway.close teardown (zwave.close, cancelJobs,
			// mqtt.close) instead of closing mqtt directly; Gateway.close leaves
			// the module-global watchers, so release them separately — in a
			// finally so a throwing gw.close still can't leak an armed watcher
			try {
				await gw.close()
			} finally {
				closeWatchers()
			}
		},
	}
}

/**
 * Managed `GatewayHarness` lifecycle for a HASS test file: one fresh harness
 * per test (call `get(options)` in a `beforeEach`, or `replace(options)` to
 * swap config mid-test), always closed in `afterEach`. Because the `mqtt` mock
 * registry and the Gateway watchers are module-global, `afterEach` also clears
 * the broker registry (so `latestBroker()` tracks the current harness and the
 * list can't grow unbounded) and the final `afterAll` closes any surviving
 * watcher and drops the isolated `STORE_DIR`.
 */
export function useGatewayHarness(): ManagedCurrent<
	GatewayHarness,
	GatewayHarnessOptions
> {
	return useManagedCurrent<GatewayHarness, GatewayHarnessOptions>(
		(options) => createGatewayHarness(options),
		(harness) => harness.close(),
		{
			afterEachCleanup: resetMqttBrokers,
			async afterAllCleanup() {
				// harness.close() already releases the current harness's
				// watchers; sweep once more in case a test threw before its
				// close, then remove the STORE_DIR api/config/app.ts captured
				const { closeWatchers } = await import('#api/lib/Gateway.ts')
				closeWatchers()
				cleanupTestEnv()
			},
		},
	)
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
