import type Gateway from '../lib/Gateway.ts'
import type {
	GatewayConfig,
	GatewayMqtt,
	GatewayZwave,
} from '../lib/Gateway.ts'
import type MqttClient from '../lib/MqttClient.ts'
import type ZWaveClient from '../lib/ZwaveClient.ts'
import type ZnifferManager from '../lib/ZnifferManager.ts'
import type { Driver } from 'zwave-js'

export type MqttClientPort = Pick<MqttClient, 'getStatus'>

export type ZwaveDriverPort = Pick<Driver, 'updateOptions' | 'updateLogConfig'>

export type ZwaveNodesPort = Pick<ZWaveClient['nodes'], 'get'>

export type ZwaveClientPort = Pick<
	ZWaveClient,
	| 'devices'
	| 'homeHex'
	| 'driverReady'
	| 'getStatus'
	| 'getState'
	| 'callApi'
	| 'storeDevices'
	| 'updateDevice'
	| 'addDevice'
	| 'getConfigurationTemplates'
	| 'createConfigurationTemplate'
	| 'importConfigurationTemplates'
	| 'getDeviceConfigurationParams'
	| 'updateConfigurationTemplate'
	| 'deleteConfigurationTemplate'
	| 'applyConfigurationTemplate'
	| 'enableStatistics'
	| 'disableStatistics'
	| 'cacheSnippets'
	| 'addExtraLogTransport'
	| 'removeExtraLogTransport'
	| 'dumpNode'
	| 'getNode'
	| 'restart'
	| 'setUserCallbacks'
	| 'removeUserCallbacks'
	| 'backupNVMRaw'
> & {
	driver: ZwaveDriverPort | null | undefined
	nodes: ZwaveNodesPort
}

export type GatewayPort = Pick<
	Gateway,
	| 'close'
	| 'start'
	| 'updateNodeTopics'
	| 'removeNodeRetained'
	| 'publishDiscovery'
	| 'rediscoverNode'
	| 'disableDiscovery'
	| 'buildDiscoveryOptions'
	| 'adoptDiscoveryManager'
> & {
	readonly zwave?: ZwaveClientPort
	readonly mqtt?: MqttClientPort
}

export type ZnifferPort = Pick<
	ZnifferManager,
	| 'status'
	| 'start'
	| 'stop'
	| 'clear'
	| 'getFrames'
	| 'setFrequency'
	| 'setLRChannelConfig'
	| 'saveCaptureToFile'
	| 'loadCaptureFromBuffer'
	| 'close'
>

export interface GatewayFactoryPort {
	create(
		config: GatewayConfig,
		zwave: (GatewayZwave & ZwaveClientPort) | undefined,
		mqtt: (GatewayMqtt & MqttClientPort) | undefined,
	): GatewayPort
	dispose(): void
}
