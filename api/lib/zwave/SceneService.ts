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

// Generic over the scene-value shape so ZwaveClient can keep using its richer ZUIValueIdScene without a circular import
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

	async removeScene(sceneid: number): Promise<boolean> {
		const index = this._scenes.findIndex((s) => s.sceneid === sceneid)

		if (index < 0) {
			throw Error('No scene found with given sceneid')
		}

		this._scenes.splice(index, 1)

		await this._persistence.put(this._scenes)

		return true
	}

	async setScenes(scenes: ZUISceneRecord<V>[]): Promise<ZUISceneRecord<V>[]> {
		// TODO: add scenes validation
		this._scenes = scenes
		await this._persistence.put(this._scenes)

		return scenes
	}

	getScenes(): ZUISceneRecord<V>[] {
		return this._scenes
	}

	sceneGetValues(sceneid: number): V[] {
		const scene = this._scenes.find((s) => s.sceneid === sceneid)
		if (!scene) {
			throw Error('No scene found with given sceneid')
		}
		return scene.values
	}

	async addSceneValue(
		sceneid: number,
		valueId: V,
		value: unknown,
		timeout: number,
	): Promise<ZUISceneRecord<V>[]> {
		const scene = this._scenes.find((s) => s.sceneid === sceneid)
		const node = this._nodes.getNode(valueId.nodeId)

		if (!scene) {
			throw Error('No scene found with given sceneid')
		}

		if (!node) {
			throw Error(`Node ${valueId.nodeId} not found`)
		} else {
			if (!node.values?.[this._utils.getValueId(valueId)]) {
				throw Error('No value found with given valueId')
			} else {
				// Edit the existing scene value if this valueId is already recorded, otherwise append a new one
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

	async removeSceneValue(
		sceneid: number,
		valueId: V,
	): Promise<ZUISceneRecord<V>[]> {
		const scene = this._scenes.find((s) => s.sceneid === sceneid)

		if (!scene) {
			throw Error('No scene found with given sceneid')
		}

		// id already embeds the node id as a prefix, so comparing it alone identifies the value within the scene
		const index = scene.values.findIndex((s) => s.id === valueId.id)

		if (index < 0) {
			throw Error('No ValueId match found in given scene')
		} else {
			scene.values.splice(index, 1)
		}

		return this._persistence.put(this._scenes)
	}

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
