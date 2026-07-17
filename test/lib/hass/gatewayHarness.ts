import type { GatewayFactory as GatewayFactoryType } from '#api/hass/GatewayFactory.ts'
import type { HassDeviceCatalog } from '#api/hass/types.ts'
import type GatewayType from '#api/lib/Gateway.ts'
import type { GatewayConfig } from '#api/lib/Gateway.ts'
import type MqttClientType from '#api/lib/MqttClient.ts'
import type { MqttConfig } from '#api/lib/MqttClient.ts'
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
	payload: any
	options: IClientPublishOptions | undefined
}

export interface GatewayHarness {
	gw: GatewayType<FakeGatewayZwave, MqttClientType>
	mqtt: MqttClientType
	zwave: FakeGatewayZwave
	broker: FakeBroker
	config: GatewayConfig
	publishedDiscoveries(): PublishedDiscovery[]
	lastDiscovery(): PublishedDiscovery
	resetPublishes(): void
	resetState(): void
	close(): Promise<void>
}

export interface GatewayHarnessOptions {
	config?: Partial<GatewayConfig>
	mqttConfig?: Partial<MqttConfig>
	zwave?: Partial<FakeGatewayZwave>
	catalogs?: HassDeviceCatalog
	gatewayFactory?: GatewayFactoryType
}

export async function createGatewayHarness(
	options: GatewayHarnessOptions = {},
): Promise<GatewayHarness> {
	const storeDir = ensureTestEnv()

	const [{ GatewayFactory }, { GatewayType }, { default: MqttClient }] =
		await Promise.all([
			import('#api/hass/GatewayFactory.ts'),
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

	const ownsFactory = options.gatewayFactory === undefined
	const gatewayFactory =
		options.gatewayFactory ??
		new GatewayFactory({
			storeDir,
			logger: {
				error: () => undefined,
				info: () => undefined,
			},
			devices: options.catalogs ?? {},
		})
	const gw = gatewayFactory.create(config, zwave, mqtt)
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
			void gw.start()
		},
		async close() {
			await gw.close()
			if (ownsFactory) gatewayFactory.dispose()
		},
	}
}

export function useGatewayHarness(): ManagedCurrent<
	GatewayHarness,
	GatewayHarnessOptions
> {
	return useManagedCurrent<GatewayHarness, GatewayHarnessOptions>(
		(options) => createGatewayHarness(options),
		(harness) => harness.close(),
		{
			afterEachCleanup: resetMqttBrokers,
			afterAllCleanup: cleanupGatewayHarnessEnv,
		},
	)
}

export function cleanupGatewayHarnessEnv(): void {
	cleanupTestEnv()
}

export function discoverValueOnNode(
	gw: Pick<GatewayType, 'discoverValue'>,
	node: ZUINode,
	valueKey: string,
): HassDevice | undefined {
	const before = new Set(Object.keys(node.hassDevices ?? {}))
	gw.discoverValue(node, valueKey)
	const after = Object.entries(node.hassDevices ?? {})
	const added = after.find(([k]) => !before.has(k))
	return added?.[1]
}
