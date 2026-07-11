/**
 * SceneService – owns all custom-scene collection/persistence state and the
 * scene CRUD + activation behavior.
 *
 * Extracted from ZwaveClient to keep the monolith slim. The service is
 * strict-clean (no `any` casts, no non-null assertions, no ts-ignore) and
 * generic over the exact scene-value shape so ZwaveClient can keep using its
 * richer `ZUIValueIdScene` type without this service importing it (avoids a
 * circular import).
 *
 * Ports:
 *   persistence – read/write scenes.json via jsonStore
 *   nodes       – read-only ZUINode lookup (existence + value-id check)
 *   utils       – ValueID stringification (matches ZwaveClient's `_getValueID`)
 *   writer      – write a value on activation
 *   logger      – structured logging for activation failures
 */

import { getErrorMessage } from '../errors.ts'
import type {
	ScenePersistencePort,
	SceneNodeStorePort,
	SceneUtilsPort,
	SceneWritePort,
	ServiceLogger,
	ZUISceneRecord,
	ZUISceneValueRef,
} from './ports.ts'

export class SceneService<V extends ZUISceneValueRef = ZUISceneValueRef> {
	private _scenes: ZUISceneRecord<V>[]

	private readonly _persistence: ScenePersistencePort<V>
	private readonly _nodes: SceneNodeStorePort
	private readonly _utils: SceneUtilsPort
	private readonly _writer: SceneWritePort<V>
	private readonly _logger: ServiceLogger

	constructor(
		persistence: ScenePersistencePort<V>,
		nodes: SceneNodeStorePort,
		utils: SceneUtilsPort,
		writer: SceneWritePort<V>,
		logger: ServiceLogger,
		initialScenes: ZUISceneRecord<V>[],
	) {
		this._persistence = persistence
		this._nodes = nodes
		this._utils = utils
		this._writer = writer
		this._logger = logger
		this._scenes = initialScenes
	}

	// ---------------------------------------------------------------
	// Public API – exact signatures preserved from ZwaveClient
	// ---------------------------------------------------------------

	/**
	 * Creates a new scene with a specific `label` and stores it in `scenes.json`
	 */
	async createScene(label: string): Promise<boolean> {
		const id =
			this._scenes.length > 0
				? this._scenes[this._scenes.length - 1].sceneid + 1
				: 1

		this._scenes.push({
			sceneid: id,
			label: label,
			values: [],
		})

		await this._persistence.put(this._scenes)

		return true
	}

	/**
	 * Delete a scene with a specific `sceneid` and updates `scenes.json`
	 */
	async removeScene(sceneid: number): Promise<boolean> {
		const index = this._scenes.findIndex((s) => s.sceneid === sceneid)

		if (index < 0) {
			throw Error('No scene found with given sceneid')
		}

		this._scenes.splice(index, 1)

		await this._persistence.put(this._scenes)

		return true
	}

	/**
	 * Imports scenes Array in `scenes.json`
	 */
	async setScenes(scenes: ZUISceneRecord<V>[]): Promise<ZUISceneRecord<V>[]> {
		// TODO: add scenes validation
		this._scenes = scenes
		await this._persistence.put(this._scenes)

		return scenes
	}

	/**
	 * Get all scenes
	 */
	getScenes(): ZUISceneRecord<V>[] {
		return this._scenes
	}

	/**
	 * Return all values of the scene with given `sceneid`
	 */
	sceneGetValues(sceneid: number): V[] {
		const scene = this._scenes.find((s) => s.sceneid === sceneid)
		if (!scene) {
			throw Error('No scene found with given sceneid')
		}
		return scene.values
	}

	/**
	 * Add a value to a scene
	 */
	async addSceneValue(
		sceneid: number,
		valueId: V,
		value: unknown,
		timeout: number,
	): Promise<unknown> {
		const scene = this._scenes.find((s) => s.sceneid === sceneid)
		const node = this._nodes.getNode(valueId.nodeId)

		if (!scene) {
			throw Error('No scene found with given sceneid')
		}

		if (!node) {
			throw Error(`Node ${valueId.nodeId} not found`)
		} else {
			// check if it is an existing valueid
			if (!node.values?.[this._utils.getValueId(valueId)]) {
				throw Error('No value found with given valueId')
			} else {
				// if this valueid is already in owr scene edit it else create new one
				const index = scene.values.findIndex((s) => s.id === valueId.id)

				const target = index < 0 ? valueId : scene.values[index]
				target.value = value
				target.timeout = timeout || 0

				if (index < 0) {
					scene.values.push(target)
				}
			}
		}

		return this._persistence.put(this._scenes)
	}

	/**
	 * Remove a value from scene
	 */
	async removeSceneValue(sceneid: number, valueId: V): Promise<unknown> {
		const scene = this._scenes.find((s) => s.sceneid === sceneid)

		if (!scene) {
			throw Error('No scene found with given sceneid')
		}

		// get the index with also the node identifier as prefix
		const index = scene.values.findIndex((s) => s.id === valueId.id)

		if (index < 0) {
			throw Error('No ValueId match found in given scene')
		} else {
			scene.values.splice(index, 1)
		}

		return this._persistence.put(this._scenes)
	}

	/**
	 * Activate a scene with given scene id
	 */
	activateScene(sceneId: number): boolean {
		const values = this.sceneGetValues(sceneId) || []

		for (let i = 0; i < values.length; i++) {
			const valueId = values[i]
			const timeout = valueId.timeout

			setTimeout(
				() => {
					this._writer
						.writeValue(valueId, valueId.value)
						.catch((error: unknown) =>
							this._logger.error(getErrorMessage(error)),
						)
				},
				timeout ? timeout * 1000 : 0,
			)
		}

		return true
	}
}
