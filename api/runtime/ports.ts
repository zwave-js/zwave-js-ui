import type Gateway from '#api/lib/Gateway'
import type MqttClient from '#api/lib/MqttClient'
import type ZWaveClient from '#api/lib/ZwaveClient'
import type ZnifferManager from '#api/lib/ZnifferManager'
import type { Driver } from 'zwave-js'

export type MqttClientPort = Pick<MqttClient, 'getStatus'>

export type ZwaveDriverPort = Pick<Driver, 'updateOptions' | 'updateLogConfig'>

export type ZwaveNodesPort = Pick<ZWaveClient['nodes'], 'get'>

export type ZwaveClientPort = Omit<
	Pick<
		ZWaveClient,
		| 'devices'
		| 'homeHex'
		| 'driverReady'
		| 'driver'
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
		| 'nodes'
		| 'restart'
		| 'setUserCallbacks'
		| 'removeUserCallbacks'
		| 'backupNVMRaw'
	>,
	'driver' | 'nodes'
> & {
	driver: ZwaveDriverPort | null | undefined
	nodes: ZwaveNodesPort
}

export type GatewayPort = Omit<
	Pick<
		Gateway,
		| 'zwave'
		| 'mqtt'
		| 'close'
		| 'start'
		| 'updateNodeTopics'
		| 'removeNodeRetained'
		| 'publishDiscovery'
		| 'rediscoverNode'
		| 'disableDiscovery'
		| 'buildDiscoveryOptions'
		| 'adoptDiscoveryManager'
	>,
	'zwave' | 'mqtt'
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
