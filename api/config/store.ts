// config/store.js

import type { GatewayConfig } from '../lib/Gateway.ts'
import type { MqttConfig } from '../lib/MqttClient.ts'
import type { ZnifferConfig } from '../lib/ZnifferManager.ts'
import type { ZwaveConfig } from '../lib/ZwaveClient.ts'
import { deviceConfigPriorityDir } from '../lib/Constants.ts'

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

export interface UiConfig {
	colorScheme?: string
	navTabs?: boolean
	compactMode?: boolean
	streamerMode?: boolean
	browserTitle?: string
}

export interface Settings {
	mqtt?: MqttConfig
	zwave?: ZwaveConfig
	gateway?: GatewayConfig
	zniffer?: ZnifferConfig
	ui?: UiConfig
}

const store: Record<StoreKeys, StoreFile> = {
	settings: {
		file: 'settings.json',
		default: {
			zwave: {
				deviceConfigPriorityDir,
				enableSoftReset: true,
			},
		} satisfies Settings,
	},
	scenes: { file: 'scenes.json', default: [] },
	nodes: { file: 'nodes.json', default: {} },
	users: { file: 'users.json', default: [] },
}

export default store
