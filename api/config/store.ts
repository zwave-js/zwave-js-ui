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
 * The "normalized" settings shape: every top-level section optional (a
 * fresh install may not have configured `mqtt`, `zniffer`, etc.), but each
 * section, once present, assumed fully populated. This is what a
 * `Gateway`/`MqttClient`/`ZWaveClient` instance's `config` constructor
 * parameter is typed against - i.e. it's the shape the app is CONSTRUCTED
 * FROM once a section has been decided to exist, not the shape read
 * directly off disk (see `PersistedSettings` below for that, and why
 * blanket-casting one to the other is exactly what this type split exists
 * to avoid).
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
 * The shape actually produced by `jsonStore` for `settings.json` (and thus
 * `jsonStore.get(store.settings)`'s real return type): a deep merge of
 * `store.settings.default` and whatever subset of fields the user has ever
 * saved. Nested properties may legitimately be missing (a partial `mqtt`
 * object with only `host` set, for instance), so this is modeled as a deep
 * partial of `Settings` rather than `Settings` itself.
 *
 * Consumers in `app.ts` read/pass this type around AS-IS (optional
 * chaining, `??=` defaulting, etc.) rather than blanket-casting it to
 * `Settings` - a single unchecked `as Settings` would silently assert every
 * nested field of every configured section is present, which is false in
 * general (e.g. a `settings.json` with `{ "mqtt": { "host": "..." } }` has
 * no `mqtt.port`/`mqtt.name`/etc., despite `MqttConfig` declaring them
 * required). The one place this repo actually treats a `PersistedSettings`
 * section as a fully-populated `Settings` section is the narrow boundary
 * where it's handed to a config-owning collaborator's constructor
 * (`new MqttClient(...)`/`new Gateway(...)`/`new ZWaveClient(...)` in
 * `app.ts`'s `startGateway`) - documented individually at each of those
 * call sites, since in practice the frontend always saves a complete
 * section object, never a sparse one (no new runtime validation is added
 * here to actually guarantee that).
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
