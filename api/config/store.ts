// config/store.js

import type { GatewayConfig } from '#api/lib/Gateway'
import type { MqttConfig } from '#api/lib/MqttClient'
import type { ZnifferConfig } from '#api/lib/ZnifferManager'
import type {
	ZUIConfigurationTemplate,
	ZUIScene,
	ZUINode,
	ZwaveConfig,
} from '#api/lib/ZwaveClient'
import type { BackupSettings } from '#api/lib/BackupManager'
import type { DeepPartial } from '#api/lib/utils'
import { deviceConfigPriorityDir } from '#api/lib/Constants'

export type StoreKeys =
	| 'settings'
	| 'scenes'
	| 'nodes'
	| 'users'
	| 'groups'
	| 'configurationTemplates'

// Schema for a single store file: where it lives on disk and its default value when the file doesn't exist yet
export interface StoreFile<T> {
	file: string
	default: T
}

export interface User {
	username: string
	passwordHash: string
	token?: string
}

// Never includes passwordHash, unlike User, for exposing to the client or persisting in the session/JWT
export type PublicUser = Omit<User, 'passwordHash'>

export interface Group {
	id: number
	name: string
	nodeIds: number[]
}

export interface UiConfig {
	colorScheme?: string
	navTabs?: boolean
	showTabLabels?: boolean
	compactMode?: boolean
	streamerMode?: boolean
	browserTitle?: string
}

// The shape a Gateway/MqttClient/ZWaveClient constructor is typed against once its section is known to exist, distinct from PersistedSettings which may be sparse
export interface Settings {
	mqtt?: MqttConfig
	zwave?: ZwaveConfig
	gateway?: GatewayConfig
	zniffer?: ZnifferConfig
	ui?: UiConfig
	backup?: BackupSettings
}

// `jsonStore.get(store.settings)`'s real return type: a deep merge of defaults and whatever subset of fields the user has ever saved, so nested properties may be missing even where `Settings` declares them required
export type PersistedSettings = DeepPartial<Settings>

// nodes.json's on-disk shape is legacy and dynamic: home-ID-keyed (current), flat node-ID-keyed (pre-multi-home-ID), or a sparse array (oldest), all still disambiguated/migrated by getStoreNodes/updateStoreNodes at runtime
export type NodesStoreRecord = Record<string, Partial<ZUINode>>
export type NodesStoreRecordByHome = Record<string, NodesStoreRecord>
export type NodesStoreFile =
	| NodesStoreRecordByHome
	| NodesStoreRecord
	| Array<Partial<ZUINode> | null | undefined>

interface StoreShape {
	settings: StoreFile<PersistedSettings>
	scenes: StoreFile<ZUIScene[]>
	nodes: StoreFile<NodesStoreFile>
	users: StoreFile<User[]>
	groups: StoreFile<Group[]>
	configurationTemplates: StoreFile<ZUIConfigurationTemplate[]>
}

const store: StoreShape = {
	settings: {
		file: 'settings.json',
		default: {
			zwave: {
				deviceConfigPriorityDir,
				enableSoftReset: true,
			},
		},
	},
	scenes: {
		file: 'scenes.json',
		default: [],
	},
	nodes: {
		file: 'nodes.json',
		default: {},
	},
	users: {
		file: 'users.json',
		default: [],
	},
	groups: {
		file: 'groups.json',
		default: [],
	},
	configurationTemplates: {
		file: 'configurationTemplates.json',
		default: [],
	},
}

export default store
