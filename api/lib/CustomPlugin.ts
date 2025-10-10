import type { Router } from 'express'
import type MqttClient from './MqttClient.ts'
import type { ModuleLogger } from './logger.ts'
import type ZwaveClient from './ZwaveClient.ts'

export interface PluginContext {
	zwave: ZwaveClient
	mqtt: MqttClient
	app: Router
	logger: ModuleLogger
}

export interface CustomPlugin extends PluginContext {
	name: string
	destroy(): Promise<void>
}

export type PluginConstructor = new (context: PluginContext) => CustomPlugin

export function createPlugin<T extends PluginConstructor>(
	constr: T,
	context: PluginContext,
	name: string,
): CustomPlugin {
	const ret = new constr(context)
	ret.name = name
	return ret
}
