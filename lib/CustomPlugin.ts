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
	name: string

	// eslint-disable-next-line @typescript-eslint/no-misused-new
	new (context: PluginContext): CustomPlugin

	destroy(): Promise<void>
}
