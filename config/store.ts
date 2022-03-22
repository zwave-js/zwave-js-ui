// config/store.js

import { GatewayConfig } from '../lib/Gateway'
import { MqttConfig } from '../lib/MqttClient'
import { ZwaveConfig, deviceConfigPriorityDir } from '../lib/ZwaveClient'

export type StoreKeys = 'settings' | 'scenes' | 'nodes' | 'users'

export interface StoreFile {
	file: string
	default: any
}

export interface User {
	username: string
	passwordHash: string
	token?: string
}

export interface Settings {
	mqtt?: MqttConfig
	zwave?: ZwaveConfig
	gateway?: GatewayConfig
}

const store: Record<StoreKeys, StoreFile> = {
	settings: {
		file: 'settings.json',
		default: {
			zwave: {
				deviceConfigPriorityDir,
				enableSoftReset: true,
			},
		},
	},
	scenes: { file: 'scenes.json', default: [] },
	nodes: { file: 'nodes.json', default: [] },
	users: { file: 'users.json', default: [] },
}

export default store
