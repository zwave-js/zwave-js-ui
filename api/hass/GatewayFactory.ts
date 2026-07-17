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
		return new Gateway(config, zwave, mqtt, this.registry.fork())
	}

	public dispose(): void {
		this.registry.dispose()
	}
}
