import { CustomDeviceRegistry } from './CustomDeviceRegistry.ts'
import type { HassLogger } from './ports.ts'
import type { HassDeviceCatalog } from './types.ts'
import Gateway from '../lib/Gateway.ts'
import type {
	GatewayConfig,
	GatewayMqtt,
	GatewayZwave,
} from '../lib/Gateway.ts'

export interface GatewayFactoryOptions {
	storeDir: string
	logger: Pick<HassLogger, 'error' | 'info'>
	devices: HassDeviceCatalog
}

export class GatewayFactory {
	private readonly registry: CustomDeviceRegistry

	public constructor(options: GatewayFactoryOptions) {
		this.registry = new CustomDeviceRegistry(options)
	}

	public create<TZwave extends GatewayZwave, TMqtt extends GatewayMqtt>(
		config: GatewayConfig,
		zwave: TZwave,
		mqtt: TMqtt,
	): Gateway<TZwave, TMqtt> {
		this.registry.start()
		// Hand the started root registry to the Gateway as the discovery source,
		// not a fork: the Gateway forwards it to MqttDiscoveryManager, which forks
		// it exactly once. A fork only refreshes from its source's notifications
		// and never re-emits them, so forking here as well would leave the
		// manager's fork subscribed to a fork that never notifies, breaking live
		// custom-device reloads. Forking once (in the manager) keeps updates
		// flowing from the watched root.
		return new Gateway(config, zwave, mqtt, this.registry)
	}

	public dispose(): void {
		this.registry.dispose()
	}
}
