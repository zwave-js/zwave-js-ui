// config/store.js

import type { GatewayConfig } from '../lib/Gateway.ts'
import type { MqttConfig } from '../lib/MqttClient.ts'
import type { ZnifferConfig } from '../lib/ZnifferManager.ts'
import type {
	ZUIConfigurationTemplate,
	ZUIScene,
	ZwaveConfig,
} from '../lib/ZwaveClient.ts'
import type { BackupSettings } from '../lib/BackupManager.ts'
import type { DeepPartial } from '../lib/utils.ts'
import { deviceConfigPriorityDir } from '../lib/Constants.ts'

export type StoreKeys =
	| 'settings'
	| 'scenes'
	| 'nodes'
	| 'users'
	| 'groups'
	| 'configurationTemplates'

/**
 * A single store file's schema: where it lives on disk (relative to
 * `storeDir`) and the default value used when the file doesn't exist yet
 * (or is merged into the persisted value for object defaults, see
 * `jsonStore`'s `_getFile`).
 */
export interface StoreFile<T> {
	file: string
	default: T
}

export interface User {
	username: string
	passwordHash: string
	token?: string
}

/**
 * The subset of `User` that is safe to expose to the client / persist in
 * the session or a JWT payload: never includes `passwordHash`. Built by
 * omitting `passwordHash` from a real `User` record (see `api/app.ts`'s
 * `/api/authenticate` and `/api/password` handlers).
 */
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

/**
 * The "normalized" settings shape assumed by consumers once settings have
 * been read from the store (e.g. `jsonStore.get(store.settings) as
 * Settings` in `app.ts`/`Gateway.ts`). Every top-level section is still
 * optional (a fresh install may not have configured `mqtt`, `zniffer`,
 * etc.), but this is the type application code is written against.
 */
export interface Settings {
	mqtt?: MqttConfig
	zwave?: ZwaveConfig
	gateway?: GatewayConfig
	zniffer?: ZnifferConfig
	ui?: UiConfig
	backup?: BackupSettings
}

/**
 * The shape actually produced by `jsonStore` for `settings.json`: a deep
 * merge of `store.settings.default` and whatever subset of fields the user
 * has ever saved. Nested properties may legitimately be missing (a partial
 * `mqtt` object with only `host` set, for instance), so this is modeled as
 * a deep partial of `Settings` rather than `Settings` itself. Consumers
 * that need the "normalized" shape narrow it explicitly (`as Settings`),
 * matching how the rest of the app already treats settings read from the
 * store.
 */
export type PersistedSettings = DeepPartial<Settings>

/**
 * `nodes.json`'s on-disk shape is legacy and dynamic: either a flat array
 * (pre-multi-home-ID format) or an object keyed by home ID, itself
 * containing an object keyed by node ID. `ZwaveClient.getStoreNodes`/
 * `updateStoreNodes` own the back-compat migration between those shapes and
 * freely reshape/reindex it (including into `ZwaveClient`'s own internal
 * node-store types), so this layer intentionally leaves it as `unknown`
 * here rather than modeling a false-precision interface, to avoid changing
 * that dynamic-key handling in `ZwaveClient` (out of scope for this pass).
 */

export type NodesStoreFile = any

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
