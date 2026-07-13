import {
	CommandClasses,
	dskToString,
	Duration,
	SecurityClass,
} from '@zwave-js/core'
import type {
	ControllerStatistics,
	NodeStatistics,
	ValueMetadata,
} from 'zwave-js'
import {
	BatteryReplacementStatus,
	FirmwareUpdateStatus,
	InterviewStage,
	MultilevelSwitchCommand,
	NodeStatus,
	Protocols,
	RemoveNodeReason,
} from 'zwave-js'
import type {
	Driver,
	FoundNode,
	FirmwareUpdateProgress,
	FirmwareUpdateResult,
	InclusionResult,
	InterviewProgress,
	NodeInterviewFailedEventArgs,
	TranslatedValueID,
	ZWaveNode,
	ZWaveNodeFirmwareUpdateFinishedCallback,
	ZWaveNodeFirmwareUpdateProgressCallback,
	ZWaveNodeMetadataUpdatedArgs,
	ZWaveNodeValueAddedArgs,
	ZWaveNodeValueNotificationArgs,
	ZWaveNodeValueRemovedArgs,
	ZWaveNodeValueUpdatedArgs,
	ZWaveNotificationCallback,
} from 'zwave-js'
import { getEnumMemberName } from 'zwave-js/Utils'
import { readFile } from 'node:fs/promises'
import { isUint8Array } from 'node:util/types'

import type {
	NodesStoreFile,
	NodesStoreRecord,
	NodesStoreRecordByHome,
} from '../../config/store.ts'
import { getErrorMessage } from '../errors.ts'
import { socketEvents } from '../SocketEvents.ts'
import * as utils from '../utils.ts'
import type {
	NodeEvent,
	ZUINode,
	ZUIValueId,
	ZwaveNodeEvents,
} from '../ZwaveClient.ts'
import { NodeProjector, type NodeProjectionDriver } from './NodeProjector.ts'
import type { ServiceLogger } from './ports.ts'

type NodeUpdate = utils.DeepPartial<ZUINode> | { firmwareUpdate: false }
type ValueUpdateArgs = (
	| ZWaveNodeValueUpdatedArgs
	| ZWaveNodeValueNotificationArgs
) & {
	prevValue?: unknown
	newValue?: unknown
	stateless?: boolean
}
type StatisticsUpdate = Pick<
	ZUINode,
	| 'statistics'
	| 'lastActive'
	| 'applicationRoute'
	| 'customSUCReturnRoutes'
	| 'customReturnRoute'
	| 'prioritySUCReturnRoute'
	| 'priorityReturnRoute'
> & { bgRssi?: ControllerStatistics['backgroundRSSI'] }
export type NodeRegistryController = Pick<
	Driver['controller'],
	| 'nodes'
	| 'ownNodeId'
	| 'supportsLongRange'
	| 'getPrioritySUCReturnRouteCached'
	| 'getCustomSUCReturnRoutesCached'
	| 'getProvisioningEntry'
	| 'getSupportedRFRegions'
	| 'on'
	| 'off'
>

export interface NodeRegistryDriver extends NodeProjectionDriver {
	controller: NodeRegistryController
}

function formatLogValue(value: unknown): string {
	// eslint-disable-next-line @typescript-eslint/no-base-to-string
	return String(value)
}

async function readFakeNodesFile(): Promise<string | undefined> {
	const filePath = utils.joinPath(true, 'fakeNodes.json')
	if (!(await utils.pathExists(filePath))) return undefined
	return readFile(filePath, 'utf-8')
}

export interface NodeRegistryHost {
	getDriver(): NodeRegistryDriver
	getZWaveNode(nodeId: number): ZWaveNode | undefined
	getGeneration(): number
	isCurrent(registry: NodeRegistry, generation: number): boolean
	getHomeHex(): string | undefined
	getMaxNodeEventsQueueSize(): number
	getPersistedNodes(): NodesStoreFile
	persistNodes(nodes: NodesStoreRecordByHome): Promise<unknown>
	debug(message: string): void
	sendToSocket(event: string, data: unknown, ...args: unknown[]): void
	logNode(
		node: ZWaveNode | ZUINode | number,
		level: 'debug' | 'info' | 'warn' | 'error',
		message: string,
		...args: unknown[]
	): void
	emitNodeUpdate(node: ZUINode, changedProps?: NodeUpdate): void
	emitValueChanged(valueId: ZUIValueId, node: ZUINode, changed: boolean): void
	emitStatistics(node: ZUINode, props: StatisticsUpdate): void
	emitNodeInited(node: ZUINode): void
	emitNodeLastActive(node: ZUINode): void
	emitNodeRemoved(node: Partial<ZUINode>): void
	emitNotification(
		node: ZUINode | undefined,
		valueId: Partial<ZUIValueId>,
		data: unknown,
	): void
	emitEvent(
		source: 'controller' | 'node',
		eventName: string,
		...args: unknown[]
	): void
	takeTmpNode(): { name?: string; loc?: string } | undefined
	onNodeFound(nodeId: number): void
	onNodeAdded(nodeId: number): void
	onReplacementComplete(): void
	isReplacing(): boolean
	subscribeObserver(node: ZUINode, valueId: ZUIValueId): void
	notifyObserver(node: ZUINode, valueId: ZUIValueId): void
	onNameLocationChanged(
		node: ZUINode,
		valueId: Pick<TranslatedValueID, 'commandClass' | 'property'>,
		value: unknown,
	): void
	updateVirtualNodesForNode(nodeId: number): void
	removeNodeFromGroups(nodeId: number): Promise<void>
	refreshBroadcastNodes(): void
	updateBroadcastNodeValues(): void
	checkConfigurationTemplates(node: ZUINode, zwaveNode: ZWaveNode): void
	getGroups(nodeId: number): void
	getSchedules(nodeId: number): Promise<unknown>
	getPriorityRoute(nodeId: number): Promise<unknown>
	getCustomSUCReturnRoute(nodeId: number): unknown
	getPrioritySUCReturnRoute(nodeId: number): unknown
	checkNodeFirmwareUpdates(nodeId: number): Promise<unknown>
	updateControllerNodeProps(node: ZUINode): Promise<unknown>
	registerDevice(node: ZUINode): void
	throttle(key: string, callback: () => void, wait: number): void
	clearThrottle(key: string): void
	isDriverReady(): boolean
}

export class NodeRegistry {
	readonly nodes = new Map<number, ZUINode>()
	storeNodes: NodesStoreRecord = {}

	private readonly host: NodeRegistryHost
	private readonly logger: ServiceLogger
	private readonly readFakeNodesFile: () => Promise<string | undefined>
	private readonly generation: number
	private cancelled = false
	private readonly listenerCleanup = new Map<ZWaveNode, Array<() => void>>()
	private readonly boundNodesById = new Map<number, ZWaveNode>()
	private controllerCleanup: Array<() => void> = []
	private readonly statelessTimeouts = new Map<string, NodeJS.Timeout>()

	constructor(
		host: NodeRegistryHost,
		logger: ServiceLogger,
		fakeNodesReader: () => Promise<string | undefined> = readFakeNodesFile,
	) {
		this.host = host
		this.logger = logger
		this.readFakeNodesFile = fakeNodesReader
		this.generation = host.getGeneration()
	}

	get current(): boolean {
		return (
			!this.cancelled &&
			this.host.isCurrent(this, this.generation) &&
			this.host.getGeneration() === this.generation
		)
	}

	close(): void {
		if (this.cancelled) return
		this.cancelled = true
		this.cleanupControllerListeners()
		for (const node of [...this.listenerCleanup.keys()]) {
			this.cleanupNodeListeners(node)
		}
		this.boundNodesById.clear()
		for (const timeout of this.statelessTimeouts.values()) {
			clearTimeout(timeout)
		}
		this.statelessTimeouts.clear()
	}

	replaceStoreNodes(nodes: NodesStoreRecord): void {
		this.storeNodes = nodes
	}

	private isCurrentNode(zwaveNode: ZWaveNode): boolean {
		if (!this.current) return false
		const currentNode = this.host
			.getDriver()
			.controller.nodes.get(zwaveNode.id)
		return currentNode === zwaveNode
	}

	async restorePersistedNodes(): Promise<void> {
		if (!this.current) return
		const homeHex = this.host.getHomeHex()
		if (!homeHex) throw new Error('HomeHex not set')

		let nodes = this.host.getPersistedNodes()
		if (Array.isArray(nodes)) {
			const converted: NodesStoreRecord = {}
			for (let index = 0; index < nodes.length; index++) {
				const candidate = nodes[index]
				if (candidate) converted[index] = candidate
			}
			nodes = converted
		}

		const keys = Object.keys(nodes)
		if (keys.length > 0 && !keys[0].startsWith('0x')) {
			// Persist legacy node stores under the home ID before exposing restored state
			const legacy = nodes
			await this.host.persistNodes({ [homeHex]: legacy })
			if (!this.current) return
			this.storeNodes = legacy
		} else {
			if (!this.current) return
			this.storeNodes = (nodes as NodesStoreRecordByHome)[homeHex] || {}
		}
	}

	private async persistSnapshot(snapshot: NodesStoreRecord): Promise<void> {
		if (!this.current) return
		const homeHex = this.host.getHomeHex()
		if (!homeHex) {
			this.logger.warn('HomeHex not set, skipping storeDevices')
			return
		}
		// Restoration migrates legacy stores before snapshots update the home-ID-keyed shape
		const nodes = this.host.getPersistedNodes() as NodesStoreRecordByHome
		nodes[homeHex] = Object.keys(snapshot).reduce((result, key) => {
			if (Object.keys(snapshot[key]).length > 0) {
				result[key] = snapshot[key]
			}
			return result
		}, {} as NodesStoreRecord)
		this.host.debug('Updating store nodes.json')
		await this.host.persistNodes(nodes)
		if (!this.current) return
	}

	async updateStoreNodes(throwError = true): Promise<void> {
		try {
			await this.persistSnapshot(this.storeNodes)
		} catch (error) {
			this.logger.error(
				`Error while updating store nodes: ${getErrorMessage(error)}`,
				error,
			)
			if (throwError) throw error
		}
	}

	async persistDetachedSnapshot(snapshot: NodesStoreRecord): Promise<void> {
		await this.persistSnapshot(snapshot)
	}

	async setNodeName(nodeId: number, name: string): Promise<boolean> {
		this.storeNodes[nodeId] ||= {}
		const node = this.nodes.get(nodeId)
		const zwaveNode = this.host.getZWaveNode(nodeId)
		if (!node || !zwaveNode) throw new Error('Invalid Node ID')

		node.name = name
		if (zwaveNode.name !== name) zwaveNode.name = name
		this.storeNodes[nodeId].name = name

		await this.updateStoreNodes()
		if (this.current && this.nodes.get(nodeId) === node) {
			this.host.emitNodeUpdate(node, { name })
		}
		return true
	}

	async setNodeLocation(nodeId: number, location: string): Promise<boolean> {
		this.storeNodes[nodeId] ||= {}
		const node = this.nodes.get(nodeId)
		const zwaveNode = this.host.getZWaveNode(nodeId)
		if (!node || !zwaveNode) throw new Error('Invalid Node ID')

		node.loc = location
		if (zwaveNode.location !== location) zwaveNode.location = location
		this.storeNodes[nodeId].loc = location

		await this.updateStoreNodes()
		if (this.current && this.nodes.get(nodeId) === node) {
			this.host.emitNodeUpdate(node, { loc: location })
		}
		return true
	}

	setNodeDefaultSetValueOptions(
		nodeId: number,
		props: Pick<ZUINode, 'defaultTransitionDuration' | 'defaultVolume'>,
	): void {
		const node = this.nodes.get(nodeId)
		const zwaveNode = this.host.getZWaveNode(nodeId)
		if (!zwaveNode) throw new Error('Invalid Node ID')

		for (const key in props) {
			const value = Reflect.get(props, key)
			Reflect.set(zwaveNode, key, value)
			if (node) Reflect.set(node, key, value)
		}
	}

	createNode(nodeId: number): ZUINode {
		const temporary = this.host.takeTmpNode()
		if (temporary) {
			const stored = this.storeNodes[nodeId] || {}
			stored.name = temporary.name
			stored.loc = temporary.loc
			this.storeNodes[nodeId] = stored
			void this.updateStoreNodes(false)
		}

		const controller = this.host.getDriver().controller
		const node = NodeProjector.createPhysicalNode(
			nodeId,
			this.storeNodes[nodeId],
			controller.getPrioritySUCReturnRouteCached(nodeId),
			controller.getCustomSUCReturnRoutesCached(nodeId),
		)
		this.nodes.set(nodeId, node)
		return node
	}

	addNode(zwaveNode: ZWaveNode): ZUINode | undefined {
		const existing = this.nodes.get(zwaveNode.id)
		if (existing?.ready) {
			this.logger.error(
				`Error while adding node ${zwaveNode.id}`,
				new Error('node has been added twice'),
			)
			return existing
		}
		this.bindNodeEvents(zwaveNode)
		this.projectNode(zwaveNode)
		this.updateNodeStatus(zwaveNode, { updateInterviewStage: true })
		this.host.logNode(zwaveNode, 'debug', 'Has been added to nodes array')
		return existing
	}

	projectNode(zwaveNode: ZWaveNode): void {
		const node = this.nodes.get(zwaveNode.id)
		if (!node) return
		NodeProjector.projectPhysicalNode(node, zwaveNode, {
			getDriver: () => this.host.getDriver(),
			getStoredNode: (nodeId) => this.storeNodes[nodeId],
			ensureStoredNode: (nodeId) => {
				this.storeNodes[nodeId] = {}
			},
			log: (physicalNode, level, message) =>
				this.host.logNode(physicalNode, level, message),
		})
	}

	removeNode(nodeId: number): void {
		const boundNode = this.boundNodesById.get(nodeId)
		if (boundNode) this.cleanupNodeListeners(boundNode)
		const node = this.nodes.get(nodeId)
		this.host.onNodeAdded(nodeId)
		if (node) {
			this.nodes.delete(nodeId)
			this.host.emitNodeRemoved({
				id: node.id,
				name: node.name,
				loc: node.loc,
			})
			this.host.sendToSocket(socketEvents.nodeRemoved, node)
		}
		if (!this.host.isReplacing() && this.storeNodes[nodeId]) {
			delete this.storeNodes[nodeId]
			void this.updateStoreNodes(false)
		}
	}

	onNodeFound(foundNode: FoundNode): void {
		if (!this.current) return
		let node: ZUINode | undefined
		if (this.host.isDriverReady()) {
			node = this.createNode(foundNode.id)
			this.host.sendToSocket(socketEvents.nodeFound, { node })
			this.host.onNodeFound(foundNode.id)
		} else {
			node = this.nodes.get(foundNode.id)
		}
		if (!node) return
		this.host.logNode(node, 'info', 'Found')
		this.host.emitNodeUpdate(node)
		this.host.emitEvent('controller', 'node found', { id: foundNode.id })
	}

	async onNodeAdded(
		zwaveNode: ZWaveNode,
		result: InclusionResult,
	): Promise<void> {
		if (!this.current) return
		let node: ZUINode | undefined
		this.host.onNodeAdded(zwaveNode.id)
		this.host.onReplacementComplete()
		if (this.host.isDriverReady()) {
			node = this.addNode(zwaveNode)
			if (!node) return
			const security = zwaveNode.getHighestSecurityClass()
			if (security) node.security = SecurityClass[security]
			if (zwaveNode.dsk) {
				const entry = this.host
					.getDriver()
					.controller.getProvisioningEntry(dskToString(zwaveNode.dsk))
				if (entry?.name) {
					await this.setNodeName(zwaveNode.id, entry.name)
					if (!this.current) return
				}
				if (entry?.location) {
					await this.setNodeLocation(zwaveNode.id, entry.location)
					if (!this.current) return
				}
			}
			this.host.sendToSocket(socketEvents.nodeAdded, { node, result })
			this.host.refreshBroadcastNodes()
			this.host.updateBroadcastNodeValues()
		}
		const security =
			node?.security ||
			(result.lowSecurity ? 'LOW SECURITY' : 'HIGH SECURITY')
		this.host.logNode(
			node ?? zwaveNode,
			'info',
			`Added with security ${security}`,
		)
		this.host.emitEvent(
			'controller',
			'node added',
			NodeProjector.zwaveNodeToJSON(zwaveNode, node),
		)
	}

	async onNodeRemoved(
		zwaveNode: ZWaveNode,
		reason: RemoveNodeReason,
	): Promise<void> {
		if (!this.current) return
		this.host.logNode(
			zwaveNode,
			'info',
			'Removed, reason: ' + getEnumMemberName(RemoveNodeReason, reason),
		)
		this.cleanupNodeListeners(zwaveNode)
		zwaveNode.removeAllListeners()
		this.host.emitEvent(
			'controller',
			'node removed',
			NodeProjector.zwaveNodeToJSON(
				zwaveNode,
				this.nodes.get(zwaveNode.id),
			),
			reason,
		)
		this.removeNode(zwaveNode.id)
		// Persist group cleanup before rebuilding live broadcast projections
		await this.host.removeNodeFromGroups(zwaveNode.id)
		if (!this.current) return
		this.host.refreshBroadcastNodes()
		this.host.updateBroadcastNodeValues()
	}

	updateNodeStatus(
		zwaveNode: ZWaveNode,
		options?: {
			updateStatusOnly?: boolean
			updateInterviewStage?: boolean
		},
	): void {
		const node = this.nodes.get(zwaveNode.id)
		if (!node) {
			this.host.logNode(
				zwaveNode,
				'error',
				"Received status update but node doesn't exists",
			)
			return
		}
		const updateStatusOnly = options?.updateStatusOnly ?? false
		node.status = NodeStatus[zwaveNode.status] as keyof typeof NodeStatus
		node.available = zwaveNode.status !== NodeStatus.Dead
		// Update interview stage only when explicitly seeded so status events cannot regress progress
		if (options?.updateInterviewStage) {
			node.interviewStage = InterviewStage[
				zwaveNode.interviewStage
			] as keyof typeof InterviewStage
		}
		if (zwaveNode.interviewStage === InterviewStage.Complete) {
			node.hasDeviceConfigChanged = zwaveNode.hasDeviceConfigChanged()
		}
		this.host.emitNodeUpdate(
			node,
			updateStatusOnly
				? { status: node.status, available: node.available }
				: undefined,
		)
	}

	onNodeEvent(
		eventName: ZwaveNodeEvents | 'status changed',
		zwaveNode: ZWaveNode,
		...args: unknown[]
	): void {
		const node = this.nodes.get(zwaveNode.id)
		if (!node) return
		const event: NodeEvent = {
			time: new Date(),
			event: eventName,
			args,
		}
		node.eventsQueue.push(event)
		this.host.sendToSocket(socketEvents.nodeEvent, {
			nodeId: node.id,
			event,
		})
		while (
			node.eventsQueue.length > this.host.getMaxNodeEventsQueueSize()
		) {
			node.eventsQueue.shift()
		}
	}

	setInterviewProgress(
		zwaveNode: ZWaveNode,
		progress: number,
		stage?: keyof typeof InterviewStage,
		throttled = false,
	): void {
		const node = this.nodes.get(zwaveNode.id)
		if (!node) return
		node.interviewProgress = progress
		const changed: NodeUpdate = { interviewProgress: progress }
		if (stage !== undefined) {
			node.interviewStage = stage
			changed.interviewStage = stage
		}
		if (throttled) {
			this.host.throttle(
				`_setInterviewProgress_${node.id}`,
				() => {
					if (this.current && this.nodes.get(node.id) === node) {
						this.host.emitNodeUpdate(node, changed)
					}
				},
				250,
			)
		} else {
			this.host.emitNodeUpdate(node, changed)
		}
	}

	onInterviewStarted(zwaveNode: ZWaveNode): void {
		this.host.logNode(zwaveNode, 'info', 'Interview started')
		this.host.emitEvent(
			'node',
			'node interview started',
			NodeProjector.zwaveNodeToJSON(
				zwaveNode,
				this.nodes.get(zwaveNode.id),
			),
		)
	}

	onInterviewStageCompleted(zwaveNode: ZWaveNode, stageName: string): void {
		this.host.logNode(
			zwaveNode,
			'info',
			`Interview stage ${stageName.toUpperCase()} completed`,
		)
		this.updateNodeStatus(zwaveNode, { updateStatusOnly: true })
		this.host.emitEvent(
			'node',
			'node interview stage completed',
			NodeProjector.zwaveNodeToJSON(
				zwaveNode,
				this.nodes.get(zwaveNode.id),
			),
		)
	}

	onInterviewCompleted(zwaveNode: ZWaveNode): void {
		// Interview completion arrives after zwave-js has published all values and metadata
		const node = this.nodes.get(zwaveNode.id)
		if (!node) return
		if (node.manufacturerId === undefined) this.projectNode(zwaveNode)
		this.host.logNode(
			zwaveNode,
			'info',
			'Interview COMPLETED, all values are updated',
		)
		this.updateNodeStatus(zwaveNode, { updateStatusOnly: true })
		void this.host.checkNodeFirmwareUpdates(zwaveNode.id).catch((error) => {
			if (!this.current || this.nodes.get(node.id) !== node) return
			this.host.logNode(
				zwaveNode,
				'error',
				`Failed to check firmware updates after interview: ${getErrorMessage(error)}`,
			)
		})
		this.host.emitEvent(
			'node',
			'node interview completed',
			NodeProjector.zwaveNodeToJSON(zwaveNode, node),
		)
	}

	onInterviewFailed(
		zwaveNode: ZWaveNode,
		args: NodeInterviewFailedEventArgs,
	): void {
		this.host.logNode(
			zwaveNode,
			'error',
			`Interview FAILED: ${args.errorMessage}`,
		)
		this.setInterviewProgress(zwaveNode, 0)
		this.updateNodeStatus(zwaveNode, { updateStatusOnly: true })
		this.host.emitEvent(
			'node',
			'node interview failed',
			NodeProjector.zwaveNodeToJSON(
				zwaveNode,
				this.nodes.get(zwaveNode.id),
			),
		)
	}

	onInterviewProgress(
		zwaveNode: ZWaveNode,
		progress: InterviewProgress,
	): void {
		this.setInterviewProgress(
			zwaveNode,
			Math.round(progress.progress),
			InterviewStage[progress.stage] as keyof typeof InterviewStage,
			true,
		)
	}

	onWakeUp(zwaveNode: ZWaveNode, oldStatus: NodeStatus): void {
		this.host.logNode(
			zwaveNode,
			'info',
			`Is ${oldStatus === NodeStatus.Unknown ? '' : 'now '}awake`,
		)
		this.updateNodeStatus(zwaveNode, { updateStatusOnly: true })
		const node = this.nodes.get(zwaveNode.id)
		if (node) {
			node.lastAwake = Date.now()
			this.host.emitNodeUpdate(node, { lastAwake: node.lastAwake })
		}
		this.emitPhysicalEvent(zwaveNode, 'node wakeup')
	}

	onSleep(zwaveNode: ZWaveNode, oldStatus: NodeStatus): void {
		this.host.logNode(
			zwaveNode,
			'info',
			`Is ${oldStatus === NodeStatus.Unknown ? '' : 'now '}asleep`,
		)
		this.updateNodeStatus(zwaveNode, { updateStatusOnly: true })
		this.emitPhysicalEvent(zwaveNode, 'node sleep')
	}

	onAlive(zwaveNode: ZWaveNode, oldStatus: NodeStatus): void {
		this.updateNodeStatus(zwaveNode, { updateStatusOnly: true })
		this.host.logNode(
			zwaveNode,
			'info',
			oldStatus === NodeStatus.Dead
				? 'Has returned from the dead'
				: 'Is alive',
		)
		this.emitPhysicalEvent(zwaveNode, 'node alive')
	}

	onDead(zwaveNode: ZWaveNode, oldStatus: NodeStatus): void {
		this.updateNodeStatus(zwaveNode, { updateStatusOnly: true })
		this.host.logNode(
			zwaveNode,
			'info',
			`Is ${oldStatus === NodeStatus.Unknown ? '' : 'now '}dead`,
		)
		this.emitPhysicalEvent(zwaveNode, 'node dead')
	}

	private emitPhysicalEvent(zwaveNode: ZWaveNode, event: string): void {
		this.host.emitEvent(
			'node',
			event,
			NodeProjector.zwaveNodeToJSON(
				zwaveNode,
				this.nodes.get(zwaveNode.id),
			),
		)
	}

	onReady(zwaveNode: ZWaveNode): void {
		const node = this.nodes.get(zwaveNode.id)
		if (!node) {
			this.host.logNode(
				zwaveNode,
				'error',
				"Ready event called but node doesn't exists",
			)
			return
		}

		const existingValues = node.values
		node.ready = false
		node.values = {}
		this.projectNode(zwaveNode)
		const delayedUpdates: Array<() => void> = []
		for (const zwaveValue of zwaveNode.getDefinedValueIDs()) {
			const result = this.addValue(
				zwaveNode,
				zwaveValue,
				existingValues,
				true,
			)
			if (!result) continue
			if (result.updated || result.valueId.writeable) {
				delayedUpdates.push(() =>
					this.host.emitValueChanged(result.valueId, node, true),
				)
			}
			this.host.subscribeObserver(node, result.valueId)
		}
		for (const update of delayedUpdates) update()

		this.host.registerDevice(node)
		node.ready = true
		if (node.isControllerNode) {
			node.supportsLongRange =
				this.host.getDriver().controller.supportsLongRange
			void this.host.updateControllerNodeProps(node).catch((error) => {
				if (!this.current || this.nodes.get(node.id) !== node) return
				this.host.logNode(
					zwaveNode,
					'error',
					`Failed to get controller node ${node.id} properties: ${getErrorMessage(error)}`,
				)
			})
		}
		node.supportsTime =
			zwaveNode.supportsCC(CommandClasses.Time) ||
			zwaveNode.supportsCC(CommandClasses['Time Parameters']) ||
			zwaveNode.supportsCC(CommandClasses.Clock) ||
			zwaveNode.supportsCC(CommandClasses['Schedule Entry Lock'])

		this.host.getGroups(zwaveNode.id)
		this.updateNodeStatus(zwaveNode, { updateInterviewStage: true })
		this.host.checkConfigurationTemplates(node, zwaveNode)
		this.host.emitEvent(
			'node',
			'node ready',
			NodeProjector.zwaveNodeToJSON(zwaveNode, node),
		)
		this.host.logNode(
			zwaveNode,
			'info',
			`Ready: ${node.manufacturer} - ${node.productLabel} (${
				node.productDescription || 'Unknown'
			})`,
		)

		if (zwaveNode.commandClasses['Schedule Entry Lock'].isSupported()) {
			this.host.logNode(
				zwaveNode,
				'info',
				'Schedule Entry Lock is supported',
			)
			void this.host.getSchedules(zwaveNode.id).catch((error) => {
				if (!this.current || this.nodes.get(node.id) !== node) return
				this.host.logNode(
					zwaveNode,
					'error',
					`Failed to get schedules for node ${node.id}: ${getErrorMessage(error)}`,
				)
			})
		}

		// Long Range uses star topology and has no return or priority routes
		if (
			!zwaveNode.isControllerNode &&
			zwaveNode.protocol !== Protocols.ZWaveLongRange
		) {
			void this.host.getPriorityRoute(zwaveNode.id).catch((error) => {
				if (!this.current || this.nodes.get(node.id) !== node) return
				this.host.logNode(
					zwaveNode,
					'error',
					`Failed to get priority route for node ${node.id}: ${getErrorMessage(error)}`,
				)
			})
			this.host.getCustomSUCReturnRoute(zwaveNode.id)
			this.host.getPrioritySUCReturnRoute(zwaveNode.id)
		}
		this.host.updateBroadcastNodeValues()
	}

	addValue(
		zwaveNode: ZWaveNode,
		zwaveValue: TranslatedValueID & {
			stateless?: boolean
			newValue?: unknown
		},
		oldValues?: Record<string, ZUIValueId>,
		skipUpdate = false,
	): { updated: boolean; valueId: ZUIValueId } | null {
		const node = this.nodes.get(zwaveNode.id)
		if (!node) {
			this.logger.info(`ValueAdded: no such node: ${zwaveNode.id} error`)
			return null
		}
		if (
			zwaveValue.commandClass ===
			CommandClasses['Node Naming and Location']
		) {
			this.host.onNameLocationChanged(
				node,
				zwaveValue,
				zwaveNode.getValue(zwaveValue),
			)
			return null
		}

		const valueId = this.parseValue(
			zwaveNode,
			zwaveValue,
			zwaveNode.getValueMetadata(zwaveValue),
		)
		const valueKey = NodeProjector.getValueId(valueId)
		const updated =
			!oldValues ||
			!oldValues[valueKey] ||
			oldValues[valueKey].value !== valueId.value
		this.host.logNode(
			zwaveNode,
			'info',
			`Value added ${valueId.id} => ${formatLogValue(valueId.value)}`,
		)
		if (!skipUpdate && updated) {
			this.host.emitValueChanged(valueId, node, true)
		}
		return { updated, valueId }
	}

	parseValue(
		zwaveNode: ZWaveNode,
		zwaveValue: TranslatedValueID & {
			stateless?: boolean
			newValue?: unknown
		},
		meta: ValueMetadata,
	): ZUIValueId {
		const node = this.nodes.get(zwaveNode.id)
		if (!node) {
			throw new Error(`Value projection for unknown node ${zwaveNode.id}`)
		}
		node.values ||= {}
		const valueKey = NodeProjector.getValueId(zwaveValue)
		const previous = node.values?.[valueKey]
		const valueId = NodeProjector.projectValue(
			zwaveNode,
			zwaveValue,
			meta,
			previous,
			previous?.value,
		)
		node.values[valueKey] = valueId
		return valueId
	}

	updateValue(zwaveNode: ZWaveNode, args: ValueUpdateArgs): void {
		const node = this.nodes.get(zwaveNode.id)
		if (!node) {
			this.logger.info(
				`valueChanged: no such node: ${zwaveNode.id} error`,
			)
			return
		}
		let skipUpdate = false
		node.values ||= {}
		const valueKey = NodeProjector.getValueId(args)
		// Create notification values on first use because they may be absent from the defined inventory
		if (!node.values[valueKey]) {
			this.addValue(zwaveNode, args)
			skipUpdate = true
		}
		const valueId = node.values[valueKey]
		if (!valueId) {
			// Handle Naming and Location updates without a defined value on unsupported nodes (#3591)
			if (
				args.commandClass === CommandClasses['Node Naming and Location']
			) {
				this.host.onNameLocationChanged(node, args, args.newValue)
			}
			return
		}
		if (valueId.toUpdate) valueId.toUpdate = false

		let newValue = args.newValue
		if (isUint8Array(newValue)) newValue = utils.buffer2hex(newValue)
		let previousValue = args.prevValue
		if (isUint8Array(previousValue)) {
			previousValue = utils.buffer2hex(previousValue)
		}
		valueId.value = newValue
		valueId.stateless = !!args.stateless
		this.host.notifyObserver(node, valueId)
		if (valueId.type === 'duration' && valueId.value === undefined) {
			valueId.value = Reflect.construct(Duration, [undefined, 'seconds'])
		}
		if (!skipUpdate) {
			this.host.emitValueChanged(
				valueId,
				node,
				previousValue !== newValue,
			)
		}

		if (valueId.stateless) {
			const currentTimeout = this.statelessTimeouts.get(valueId.id)
			if (currentTimeout) clearTimeout(currentTimeout)
			const generation = this.generation
			const timeout = setTimeout(() => {
				this.statelessTimeouts.delete(valueId.id)
				if (
					!this.current ||
					this.host.getGeneration() !== generation ||
					this.nodes.get(node.id) !== node ||
					node.values?.[valueKey] !== valueId
				) {
					return
				}
				valueId.value = undefined
				// Publish every stateless reset because repeated notifications still clear observable state
				this.host.emitValueChanged(valueId, node, true)
			}, 1000)
			this.statelessTimeouts.set(valueId.id, timeout)
		}
	}

	removeValue(zwaveNode: ZWaveNode, args: ZWaveNodeValueRemovedArgs): void {
		const node = this.nodes.get(zwaveNode.id)
		const valueKey = NodeProjector.getValueId(args)
		const removed = node?.values?.[valueKey]
		if (removed && node) {
			delete node.values?.[valueKey]
			const timeout = this.statelessTimeouts.get(removed.id)
			if (timeout) {
				clearTimeout(timeout)
				this.statelessTimeouts.delete(removed.id)
			}
			this.host.sendToSocket(socketEvents.valueRemoved, removed)
			this.host.logNode(zwaveNode, 'info', `ValueId ${valueKey} removed`)
		} else {
			this.host.logNode(
				zwaveNode,
				'warn',
				`ValueId ${valueKey} removed: no such node`,
			)
		}
	}

	onValueAdded(zwaveNode: ZWaveNode, args: ZWaveNodeValueAddedArgs): void {
		this.host.logNode(
			zwaveNode,
			'info',
			`Value added: ${NodeProjector.getValueId(args)} => ${formatLogValue(
				args.newValue,
			)}`,
		)
		if (zwaveNode.ready) {
			const result = this.addValue(zwaveNode, args)
			const node = this.nodes.get(zwaveNode.id)
			if (result && node)
				this.host.subscribeObserver(node, result.valueId)
		}
		this.host.emitEvent(
			'node',
			'node value added',
			NodeProjector.zwaveNodeToJSON(
				zwaveNode,
				this.nodes.get(zwaveNode.id),
			),
			args,
		)
	}

	onValueNotification(
		zwaveNode: ZWaveNode,
		args: ZWaveNodeValueNotificationArgs & {
			newValue?: unknown
			stateless: boolean
		},
	): void {
		// Map notification value to the stateless update shape used by shared handlers
		args.newValue = args.value
		args.stateless = true
		this.onValueUpdated(zwaveNode, args)
	}

	onValueUpdated(zwaveNode: ZWaveNode, args: ValueUpdateArgs): void {
		this.updateValue(zwaveNode, args)
		this.host.logNode(
			zwaveNode,
			'info',
			`Value ${
				args.stateless ? 'notification' : 'updated'
			}: ${NodeProjector.getValueId(args)} ${
				args.stateless
					? formatLogValue(args.newValue)
					: `${formatLogValue(args.prevValue)} => ${formatLogValue(
							args.newValue,
						)}`
			}`,
		)
		this.host.emitEvent(
			'node',
			'node value updated',
			NodeProjector.zwaveNodeToJSON(
				zwaveNode,
				this.nodes.get(zwaveNode.id),
			),
			args,
		)
	}

	onValueRemoved(
		zwaveNode: ZWaveNode,
		args: ZWaveNodeValueRemovedArgs,
	): void {
		this.removeValue(zwaveNode, args)
		this.host.logNode(
			zwaveNode,
			'info',
			`Value removed: ${NodeProjector.getValueId(args)}`,
		)
		this.host.emitEvent(
			'node',
			'node value removed',
			NodeProjector.zwaveNodeToJSON(
				zwaveNode,
				this.nodes.get(zwaveNode.id),
			),
			args,
		)
	}

	onMetadataUpdated(
		zwaveNode: ZWaveNode,
		args: ZWaveNodeMetadataUpdatedArgs,
	): void {
		if (!args.metadata) {
			throw new Error('Metadata update is missing metadata')
		}
		const value = this.parseValue(zwaveNode, args, args.metadata)
		this.host.sendToSocket(socketEvents.metadataUpdated, value)
		this.host.logNode(
			zwaveNode,
			'info',
			`Metadata updated: ${NodeProjector.getValueId(args)}`,
		)
		this.host.emitEvent(
			'node',
			'node metadata updated',
			NodeProjector.zwaveNodeToJSON(
				zwaveNode,
				this.nodes.get(zwaveNode.id),
			),
			args,
		)
	}

	onStatisticsUpdated(zwaveNode: ZWaveNode, stats: NodeStatistics): void {
		const node = this.nodes.get(zwaveNode.id)
		if (node) {
			node.statistics = { ...stats }
			if (stats.lastSeen) {
				node.lastActive = stats.lastSeen.getTime()
				this.host.emitNodeLastActive(node)
			}
			this.host.emitStatistics(node, {
				statistics: stats,
				lastActive: node.lastActive,
				applicationRoute: node.applicationRoute || null,
			})
		}
		this.host.emitEvent(
			'node',
			'statistics updated',
			NodeProjector.zwaveNodeToJSON(zwaveNode, node),
			stats,
		)
	}

	onInfoReceived(zwaveNode: ZWaveNode): void {
		this.host.logNode(zwaveNode, 'info', 'Node info (NIF) received')
		this.emitPhysicalEvent(zwaveNode, 'node info received')
	}

	readonly onFirmwareUpdateProgress: ZWaveNodeFirmwareUpdateProgressCallback =
		(zwaveNode, progress) => {
			if (!this.current) return
			const node = this.nodes.get(zwaveNode.id)
			if (node) {
				node.firmwareUpdate = progress
				this.host.throttle(
					`_onNodeFirmwareUpdateProgress_${node.id}`,
					() => {
						if (this.current && this.nodes.get(node.id) === node) {
							this.host.emitNodeUpdate(node, {
								firmwareUpdate: progress,
							})
						}
					},
					250,
				)
			}
			this.host.emitEvent(
				'node',
				'node firmware update progress',
				NodeProjector.zwaveNodeToJSON(zwaveNode, node),
				progress,
			)
		}

	readonly onFirmwareUpdateFinished: ZWaveNodeFirmwareUpdateFinishedCallback =
		(zwaveNode, result) => {
			if (!this.current) return
			const node = this.nodes.get(zwaveNode.id)
			if (node) {
				node.firmwareUpdate = undefined
				this.host.clearThrottle(
					`_onNodeFirmwareUpdateProgress_${node.id}`,
				)
				this.host.emitNodeUpdate(node, { firmwareUpdate: false })
			}
			this.host.logNode(
				zwaveNode,
				'info',
				`Firmware update finished ${
					result.success ? 'successfully' : 'with error'
				}.\n   Status: ${getEnumMemberName(
					FirmwareUpdateStatus,
					result.status,
				)}.\n   Wait before interacting: ${
					result.waitTime !== undefined ? `${result.waitTime}s` : 'No'
				}.\n   Result: ${JSON.stringify(result)}.`,
			)
			this.host.emitEvent(
				'node',
				'node firmware update finished',
				NodeProjector.zwaveNodeToJSON(zwaveNode, node),
				result,
			)
		}

	onControllerStatisticsUpdated(stats: ControllerStatistics): void {
		if (!this.current) return
		let controllerId: number | undefined
		try {
			controllerId = this.host.getDriver().controller.ownNodeId
		} catch {
			return
		}
		const node =
			typeof controllerId === 'number'
				? this.nodes.get(controllerId)
				: undefined
		if (node) {
			const oldStats = node.statistics
			node.statistics = stats
			const previousMessagesRX =
				oldStats && 'messagesRX' in oldStats ? oldStats.messagesRX : 0
			if (stats.messagesRX > previousMessagesRX) {
				node.lastActive = Date.now()
			}
			const backgroundRSSI = stats.backgroundRSSI
			if (backgroundRSSI) {
				node.bgRSSIPoints ||= []
				const points = node.bgRSSIPoints
				points.push(backgroundRSSI)
				const minimumTimestamp =
					backgroundRSSI.timestamp - 3 * 60 * 60 * 1000
				while (
					points.length > 360 ||
					(points[0]?.timestamp ?? minimumTimestamp) <
						minimumTimestamp
				) {
					points.shift()
				}
			}
			this.host.emitStatistics(node, {
				statistics: stats,
				lastActive: node.lastActive,
				bgRssi: backgroundRSSI,
			})
		}
		this.host.emitEvent('controller', 'statistics updated', stats)
	}

	bindControllerEvents(controller: NodeRegistryController): void {
		if (!this.current) return
		this.cleanupControllerListeners()
		const guard = (callback: () => void): void => {
			if (
				this.current &&
				this.host.getDriver().controller === controller
			) {
				callback()
			}
		}
		const nodeFound = (node: FoundNode) =>
			guard(() => this.onNodeFound(node))
		const nodeAdded = (node: ZWaveNode, result: InclusionResult) =>
			guard(() => {
				void this.onNodeAdded(node, result)
			})
		const nodeRemoved = (node: ZWaveNode, reason: RemoveNodeReason) =>
			guard(() => {
				void this.onNodeRemoved(node, reason)
			})
		const statisticsUpdated = (stats: ControllerStatistics) =>
			guard(() => this.onControllerStatisticsUpdated(stats))

		controller.on('node found', nodeFound)
		controller.on('node added', nodeAdded)
		controller.on('node removed', nodeRemoved)
		controller.on('statistics updated', statisticsUpdated)
		this.controllerCleanup = [
			() => controller.off('node found', nodeFound),
			() => controller.off('node added', nodeAdded),
			() => controller.off('node removed', nodeRemoved),
			() => controller.off('statistics updated', statisticsUpdated),
		]
	}

	private cleanupControllerListeners(): void {
		for (const remove of this.controllerCleanup) remove()
		this.controllerCleanup = []
	}

	readonly onNotification: ZWaveNotificationCallback = (
		endpoint,
		commandClass,
		args,
	) => {
		if (!this.current) return
		const zwaveNode = endpoint.tryGetNode()
		if (!zwaveNode) {
			this.host.logNode(
				endpoint.nodeId,
				'error',
				"Notification received but node doesn't exist",
			)
			return
		}
		const valueId: Partial<ZUIValueId> = {
			nodeId: zwaveNode.id,
			commandClass,
			commandClassName: CommandClasses[commandClass],
		}
		let data: unknown = null
		switch (commandClass) {
			case CommandClasses.Notification:
				valueId.property = args.label
				valueId.propertyKey = args.eventLabel
				data = NodeProjector.parseNotification(args.parameters)
				break
			case CommandClasses['Entry Control']:
				valueId.property = args.eventType.toString()
				valueId.propertyKey = args.dataType
				data = isUint8Array(args.eventData)
					? utils.buffer2hex(args.eventData)
					: args.eventData
				break
			case CommandClasses['Multilevel Switch']:
				valueId.property = getEnumMemberName(
					MultilevelSwitchCommand,
					args.eventType,
				)
				data = args.direction
				break
			case CommandClasses.Powerlevel:
				// Ignore Powerlevel notifications because zwave-js handles them
				return
			case CommandClasses.Battery:
				valueId.property = args.eventType
				data = getEnumMemberName(BatteryReplacementStatus, args.urgency)
				break
			default:
				this.host.logNode(
					zwaveNode,
					'error',
					'Unknown notification received CC %s: %o',
					valueId.commandClassName,
					args,
				)
				return
		}
		valueId.id = NodeProjector.getValueId(
			{
				nodeId: valueId.nodeId,
				commandClass: valueId.commandClass ?? commandClass,
				endpoint: valueId.endpoint,
				property: valueId.property ?? '',
				propertyKey: valueId.propertyKey,
			},
			true,
		)
		// Define propertyName because named MQTT topics require it
		valueId.propertyName = valueId.property
		this.host.logNode(
			zwaveNode,
			'info',
			'CC %s notification %o',
			valueId.commandClassName,
			args,
		)
		const node = this.nodes.get(zwaveNode.id)
		this.host.emitNotification(node, valueId, data)
		this.host.emitEvent(
			'node',
			'node notification',
			NodeProjector.zwaveNodeToJSON(zwaveNode, node),
			commandClass,
			args,
		)
	}

	bindNodeEvents(zwaveNode: ZWaveNode): void {
		if (!this.current) return
		const previousNode = this.boundNodesById.get(zwaveNode.id)
		if (previousNode && previousNode !== zwaveNode) {
			this.cleanupNodeListeners(previousNode)
		}
		this.cleanupNodeListeners(zwaveNode)
		this.boundNodesById.set(zwaveNode.id, zwaveNode)
		this.host.logNode(zwaveNode, 'debug', 'Binding to node events')
		const generation = this.generation
		const guard = (callback: () => void): void => {
			if (
				this.host.getGeneration() === generation &&
				this.isCurrentNode(zwaveNode)
			) {
				callback()
			}
		}
		const cleanup: Array<() => void> = []
		const ready = () => guard(() => this.onReady(zwaveNode))
		zwaveNode.on('ready', ready)
		cleanup.push(() => zwaveNode.off('ready', ready))
		// zwave-js emits interview start and completion only for initial or manually restarted interviews
		const interviewStarted = () =>
			guard(() => this.onInterviewStarted(zwaveNode))
		zwaveNode.on('interview started', interviewStarted)
		cleanup.push(() => zwaveNode.off('interview started', interviewStarted))
		const stageCompleted = (_node: ZWaveNode, stage: string) =>
			guard(() => this.onInterviewStageCompleted(zwaveNode, stage))
		zwaveNode.on('interview stage completed', stageCompleted)
		cleanup.push(() =>
			zwaveNode.off('interview stage completed', stageCompleted),
		)
		const interviewCompleted = () =>
			guard(() => this.onInterviewCompleted(zwaveNode))
		zwaveNode.on('interview completed', interviewCompleted)
		cleanup.push(() =>
			zwaveNode.off('interview completed', interviewCompleted),
		)
		const interviewFailed = (
			_node: ZWaveNode,
			args: NodeInterviewFailedEventArgs,
		) => guard(() => this.onInterviewFailed(zwaveNode, args))
		zwaveNode.on('interview failed', interviewFailed)
		cleanup.push(() => zwaveNode.off('interview failed', interviewFailed))
		const interviewProgress = (
			_node: ZWaveNode,
			progress: InterviewProgress,
		) => guard(() => this.onInterviewProgress(zwaveNode, progress))
		zwaveNode.on('interview progress', interviewProgress)
		cleanup.push(() =>
			zwaveNode.off('interview progress', interviewProgress),
		)
		const wakeUp = (_node: ZWaveNode, oldStatus: NodeStatus) =>
			guard(() => this.onWakeUp(zwaveNode, oldStatus))
		zwaveNode.on('wake up', wakeUp)
		cleanup.push(() => zwaveNode.off('wake up', wakeUp))
		const sleep = (_node: ZWaveNode, oldStatus: NodeStatus) =>
			guard(() => this.onSleep(zwaveNode, oldStatus))
		zwaveNode.on('sleep', sleep)
		cleanup.push(() => zwaveNode.off('sleep', sleep))
		const alive = (_node: ZWaveNode, oldStatus: NodeStatus) =>
			guard(() => this.onAlive(zwaveNode, oldStatus))
		zwaveNode.on('alive', alive)
		cleanup.push(() => zwaveNode.off('alive', alive))
		const dead = (_node: ZWaveNode, oldStatus: NodeStatus) =>
			guard(() => this.onDead(zwaveNode, oldStatus))
		zwaveNode.on('dead', dead)
		cleanup.push(() => zwaveNode.off('dead', dead))
		const valueAdded = (_node: ZWaveNode, args: ZWaveNodeValueAddedArgs) =>
			guard(() => this.onValueAdded(zwaveNode, args))
		zwaveNode.on('value added', valueAdded)
		cleanup.push(() => zwaveNode.off('value added', valueAdded))
		const valueUpdated = (
			_node: ZWaveNode,
			args: ZWaveNodeValueUpdatedArgs,
		) => guard(() => this.onValueUpdated(zwaveNode, args))
		zwaveNode.on('value updated', valueUpdated)
		cleanup.push(() => zwaveNode.off('value updated', valueUpdated))
		const valueNotification = (
			_node: ZWaveNode,
			args: ZWaveNodeValueNotificationArgs,
		) =>
			guard(() =>
				this.onValueNotification(
					zwaveNode,
					Object.assign(args, { stateless: true }),
				),
			)
		zwaveNode.on('value notification', valueNotification)
		cleanup.push(() =>
			zwaveNode.off('value notification', valueNotification),
		)
		const valueRemoved = (
			_node: ZWaveNode,
			args: ZWaveNodeValueRemovedArgs,
		) => guard(() => this.onValueRemoved(zwaveNode, args))
		zwaveNode.on('value removed', valueRemoved)
		cleanup.push(() => zwaveNode.off('value removed', valueRemoved))
		const metadataUpdated = (
			_node: ZWaveNode,
			args: ZWaveNodeMetadataUpdatedArgs,
		) => guard(() => this.onMetadataUpdated(zwaveNode, args))
		zwaveNode.on('metadata updated', metadataUpdated)
		cleanup.push(() => zwaveNode.off('metadata updated', metadataUpdated))
		const notification: ZWaveNotificationCallback = (...args) =>
			guard(() => this.onNotification(...args))
		zwaveNode.on('notification', notification)
		cleanup.push(() => zwaveNode.off('notification', notification))
		const firmwareProgress: ZWaveNodeFirmwareUpdateProgressCallback = (
			node,
			progress,
		) => guard(() => this.onFirmwareUpdateProgress(node, progress))
		zwaveNode.on('firmware update progress', firmwareProgress)
		cleanup.push(() =>
			zwaveNode.off('firmware update progress', firmwareProgress),
		)
		const firmwareFinished: ZWaveNodeFirmwareUpdateFinishedCallback = (
			node,
			result,
		) => guard(() => this.onFirmwareUpdateFinished(node, result))
		zwaveNode.on('firmware update finished', firmwareFinished)
		cleanup.push(() =>
			zwaveNode.off('firmware update finished', firmwareFinished),
		)
		const statistics = (_node: ZWaveNode, stats: NodeStatistics) =>
			guard(() => this.onStatisticsUpdated(zwaveNode, stats))
		zwaveNode.on('statistics updated', statistics)
		cleanup.push(() => zwaveNode.off('statistics updated', statistics))
		const info = () => guard(() => this.onInfoReceived(zwaveNode))
		zwaveNode.on('node info received', info)
		cleanup.push(() => zwaveNode.off('node info received', info))

		const queueEvents: ZwaveNodeEvents[] = [
			'ready',
			'interview started',
			'interview stage completed',
			'interview completed',
			'interview failed',
			'wake up',
			'sleep',
			'alive',
			'dead',
			'value added',
			'value updated',
			'value notification',
			'value removed',
			'notification',
			'firmware update progress',
			'firmware update finished',
		]
		for (const event of queueEvents) {
			const listener = (...args: unknown[]) =>
				guard(() => {
					// Queue only node callbacks because notifications start with an endpoint
					if (args[0] === zwaveNode) {
						this.onNodeEvent(event, zwaveNode, ...args.slice(1))
					}
				})
			zwaveNode.on(event, listener)
			cleanup.push(() => zwaveNode.off(event, listener))
		}
		this.listenerCleanup.set(zwaveNode, cleanup)
	}

	cleanupNodeListeners(zwaveNode: ZWaveNode): void {
		const cleanup = this.listenerCleanup.get(zwaveNode)
		if (!cleanup) return
		this.listenerCleanup.delete(zwaveNode)
		if (this.boundNodesById.get(zwaveNode.id) === zwaveNode) {
			this.boundNodesById.delete(zwaveNode.id)
		}
		for (const remove of cleanup) remove()
	}

	async loadFakeNodes(): Promise<void> {
		type FakeNode = Omit<ZUINode, 'values'> & { values: ZUIValueId[] }
		const contents = await this.readFakeNodesFile()
		if (!this.current) return
		if (contents === undefined) return
		const fakeNodes: FakeNode[] = JSON.parse(contents)
		for (const fakeNode of fakeNodes) {
			if (!this.current) return
			const values: Record<string, ZUIValueId> = {}
			for (const value of fakeNode.values) {
				values[NodeProjector.getValueId(value)] = value
			}
			const node: ZUINode = { ...fakeNode, values }
			node.inited = false
			node.hassDevices = {}
			this.nodes.set(node.id, node)
			this.host.emitNodeUpdate(node)
		}
	}
}
