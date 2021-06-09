import { Router } from 'express'
import MqttClient from './MqttClient'
import { ModuleLogger } from './logger'
import ZwaveClient from './ZwaveClient'

export type PluginContext = {
	zwave: ZwaveClient
	mqtt: MqttClient
	app: Router
	logger: ModuleLogger
}

export interface CustomPlugin {
	zwave: ZwaveClient
	mqtt: MqttClient
	app: Router
	logger: ModuleLogger

	new (context: PluginContext)

	destroy(): Promise<void>
}
