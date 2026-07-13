/**
 * Characterizes ZwaveClient's OWN facade/wiring layer around the
 * association/group refactor - not AssociationService/GroupService's own
 * logic, which `AssociationService.test.ts`/`GroupService.test.ts` cover
 * exhaustively (including the stale-driver-across-await and
 * generation-fencing regressions themselves).
 *
 * Startup restoration is exercised as `GroupService` loading groups from
 * disk at construction, plus the exact 2-statement loop
 * (`ZwaveClient.ts:5051-5053`) directly - not the full `_onDriverReady()`,
 * which needs ~10 controller event listeners and a full node/fake-node
 * graph too heavy to fake honestly for what this needs proven.
 *
 * Store isolation: `ZwaveClient` is imported here as `import type` only,
 * with the runtime value loaded via a dynamic `import()` inside `beforeAll`
 * after `createSocketHarness()` has isolated `STORE_DIR` - a static import
 * would cache the real repository `store/` directory instead (see
 * `outboundProducers.test.ts`'s doc comment for the full mechanics).
 *
 * `harness.jsonStore`'s `groups.json` state persists across every test in
 * this file (`afterEach`'s `resetState()` doesn't clear it, see
 * `harness.ts`). Most tests seed `_groupService._groups` directly after
 * constructing; the tests characterizing construction-time disk loading
 * (and node removal, whose index a direct post-construction `_groups`
 * overwrite would leave stale until the next mutating call) seed
 * `groups.json` itself beforehand instead.
 */
import {
	describe,
	it,
	expect,
	vi,
	beforeAll,
	beforeEach,
	afterAll,
	afterEach,
} from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { CommandClasses, ValueMetadata } from '@zwave-js/core'
import { AssociationCheckResult, RemoveNodeReason } from 'zwave-js'
import type { VirtualValueID } from 'zwave-js'
import { socketEvents } from '../../../api/lib/SocketEvents.ts'
import type ZWaveClientType from '../../../api/lib/ZwaveClient.ts'
import type { ZUIValueId, ZUINode } from '../../../api/lib/ZwaveClient.ts'
import { createSocketHarness, type SocketHarness } from './harness.ts'
import { createFakeGateway } from './fakes.ts'
import { getTestStoreDir } from './env.ts'

/** A real `ValueMetadata.Boolean` preset for a real Binary Switch CC value. */
const booleanVirtualValueId: VirtualValueID = {
	commandClass: CommandClasses['Binary Switch'],
	commandClassName: 'Binary Switch',
	endpoint: 0,
	property: 'currentValue',
	propertyName: 'currentValue',
	ccVersion: 2,
	metadata: { ...ValueMetadata.Boolean, label: 'Current value' },
}

/** A real `ValueMetadata.Number` preset for a real Multilevel Switch CC value. */
const numericVirtualValueId: VirtualValueID = {
	commandClass: CommandClasses['Multilevel Switch'],
	commandClassName: 'Multilevel Switch',
	endpoint: 0,
	property: 'currentValue',
	propertyName: 'currentValue',
	ccVersion: 4,
	metadata: {
		...ValueMetadata.Number,
		label: 'Current value',
		min: 0,
		max: 99,
		unit: '%',
	},
}

describe('ZwaveClient service wiring: association/group facades, buildVirtualValueId, startup restoration, node removal, socket projection', () => {
	let harness: SocketHarness
	let ZWaveClient: typeof ZWaveClientType

	beforeAll(async () => {
		// STORE_DIR must be isolated (via the harness) before ZwaveClient.ts is
		// imported, since it reads it at module-evaluation time - see the file
		// doc comment's "Store isolation" section
		harness = await createSocketHarness()
		;({ default: ZWaveClient } = await import(
			'../../../api/lib/ZwaveClient.ts'
		))
	})

	afterAll(async () => {
		await harness.close()
	})

	beforeEach(() => {
		// Every spy here targets a fresh per-test instance, but restore first anyway in case a future test spies on shared/prototype state
		vi.restoreAllMocks()

		// The real 'clients' connect callback calls gw.zwave?.setUserCallbacks(), so gw itself must be truthy or it throws
		harness.testHooks.setGateway(
			createFakeGateway({ zwave: undefined }) as any,
		)
	})

	afterEach(async () => {
		await harness.disconnectAllClients()
		harness.resetState()
	})

	/** Real `ZWaveClient`, wired to the harness's real Socket.IO server. */
	function realZwave(): ZWaveClientType {
		return new ZWaveClient({} as any, harness.io)
	}

	function subscribe(client: any, channels: string[]): Promise<any> {
		return new Promise((resolve) => {
			client.emit('SUBSCRIBE', { channels }, resolve)
		})
	}

	async function connectedSubscriber(channel: string) {
		const client = harness.createClient()
		await harness.connectClient(client)
		await subscribe(client, [channel])
		return client
	}

	/** Resolves the first time `event` is received on `client`. */
	function waitForEvent<T = unknown>(client: any, event: string): Promise<T> {
		return new Promise((resolve) => client.once(event, resolve))
	}

	/**
	 * Resolves the first time `NODE_UPDATED` arrives on `client` carrying a
	 * non-empty `values` map - filters out the earlier, bare-shell
	 * `NODE_UPDATED` that `createVirtualNode()` (`GroupService.ts:343`)
	 * sends before `_updateVirtualNodeValues()` populates and re-emits it.
	 */
	function waitForNodeUpdatedWithValues(client: any): Promise<any> {
		return new Promise((resolve) => {
			function onUpdate(payload: any) {
				if (payload?.values && Object.keys(payload.values).length > 0) {
					client.off('NODE_UPDATED', onUpdate)
					resolve(payload)
				}
			}
			client.on('NODE_UPDATED', onUpdate)
		})
	}

	describe('association facade (ZwaveClient.ts:1695-1805) - thin wiring to the real, independently-tested AssociationService', () => {
		/**
		 * A stateful fake controller association table (source nodeId ->
		 * groupId -> AssociationAddress[]), driving the real, unmocked
		 * AssociationService - whose own exhaustive business-logic tests live
		 * in AssociationService.test.ts - through ZwaveClient's real public
		 * API. Forbids self-association like a real controller would, so
		 * checkAssociation()/addAssociations() have a genuine allow/forbid
		 * branch to prove the facade threads real driver results through
		 * rather than a mocked method's canned return value.
		 */
		function fakeAssociationDriver(
			nodeIds: number[],
			initial: Record<number, Record<number, { nodeId: number }[]>> = {},
		) {
			const table = new Map<number, Map<number, { nodeId: number }[]>>(
				Object.entries(initial).map(([nodeId, groups]) => [
					Number(nodeId),
					new Map(
						Object.entries(groups).map(([groupId, assocs]) => [
							Number(groupId),
							assocs,
						]),
					),
				]),
			)
			function groupsFor(nodeId: number) {
				let groups = table.get(nodeId)
				if (!groups) {
					groups = new Map()
					table.set(nodeId, groups)
				}
				return groups
			}
			return {
				controller: {
					ownNodeId: 1,
					nodes: new Map(
						nodeIds.map((id) => [
							id,
							{ id, refreshCCValues: () => Promise.resolve() },
						]),
					),
					getAllAssociations: (nodeId: number) =>
						new Map([[{ nodeId }, groupsFor(nodeId)]]),
					checkAssociation: (
						source: { nodeId: number },
						_groupId: number,
						association: { nodeId: number },
					) =>
						source.nodeId === association.nodeId
							? AssociationCheckResult.Forbidden_SelfAssociation
							: AssociationCheckResult.OK,
					addAssociations: (
						source: { nodeId: number },
						groupId: number,
						associations: { nodeId: number }[],
					) => {
						const groups = groupsFor(source.nodeId)
						groups.set(groupId, [
							...(groups.get(groupId) ?? []),
							...associations,
						])
						return Promise.resolve()
					},
					removeAssociations: (
						source: { nodeId: number },
						groupId: number,
						associations: { nodeId: number }[],
					) => {
						const groups = groupsFor(source.nodeId)
						groups.set(
							groupId,
							(groups.get(groupId) ?? []).filter(
								(a) =>
									!associations.some(
										(r) => r.nodeId === a.nodeId,
									),
							),
						)
						return Promise.resolve()
					},
					removeNodeFromAllAssociations: (nodeId: number) => {
						for (const groups of table.values()) {
							for (const [groupId, assocs] of groups) {
								groups.set(
									groupId,
									assocs.filter((a) => a.nodeId !== nodeId),
								)
							}
						}
						return Promise.resolve()
					},
				},
			}
		}

		it('getAssociations() returns the real controller associations for a node, and an empty array for a node with none', async () => {
			const zwave = realZwave()
			;(zwave as any)._driver = fakeAssociationDriver([2, 5], {
				2: { 1: [{ nodeId: 5 }] },
			})

			await expect(zwave.getAssociations(2, true)).resolves.toEqual([
				{
					endpoint: undefined,
					groupId: 1,
					nodeId: 5,
					targetEndpoint: undefined,
				},
			])
			await expect(zwave.getAssociations(5)).resolves.toEqual([])
		})

		it('checkAssociation() returns the real controller check result, forbidding self-association and allowing a distinct target', () => {
			const zwave = realZwave()
			;(zwave as any)._driver = fakeAssociationDriver([2, 3])

			expect(
				zwave.checkAssociation({ nodeId: 2 }, 1, { nodeId: 2 }),
			).toBe(AssociationCheckResult.Forbidden_SelfAssociation)
			expect(
				zwave.checkAssociation({ nodeId: 2 }, 1, { nodeId: 3 }),
			).toBe(AssociationCheckResult.OK)
		})

		it('addAssociations() adds only the associations the real controller check allows, returns the real per-candidate check results, and getAssociations() reflects the addition', async () => {
			const zwave = realZwave()
			;(zwave as any)._driver = fakeAssociationDriver([2, 3])

			const results = await zwave.addAssociations({ nodeId: 2 }, 1, [
				{ nodeId: 2 },
				{ nodeId: 3 },
			])

			expect(results).toEqual([
				AssociationCheckResult.Forbidden_SelfAssociation,
				AssociationCheckResult.OK,
			])
			expect(await zwave.getAssociations(2)).toEqual([
				{
					endpoint: undefined,
					groupId: 1,
					nodeId: 3,
					targetEndpoint: undefined,
				},
			])
		})

		it('addAssociations() with force:true bypasses a forbidden real check result and adds it anyway', async () => {
			const zwave = realZwave()
			;(zwave as any)._driver = fakeAssociationDriver([2])

			await zwave.addAssociations({ nodeId: 2 }, 1, [{ nodeId: 2 }], {
				force: true,
			})

			expect(await zwave.getAssociations(2)).toEqual([
				{
					endpoint: undefined,
					groupId: 1,
					nodeId: 2,
					targetEndpoint: undefined,
				},
			])
		})

		it('removeAssociations() removes only the targeted association, leaving the rest of the same group intact', async () => {
			const zwave = realZwave()
			;(zwave as any)._driver = fakeAssociationDriver([2, 3, 4], {
				2: { 1: [{ nodeId: 3 }, { nodeId: 4 }] },
			})

			await zwave.removeAssociations({ nodeId: 2 }, 1, [{ nodeId: 3 }])

			expect(await zwave.getAssociations(2)).toEqual([
				{
					endpoint: undefined,
					groupId: 1,
					nodeId: 4,
					targetEndpoint: undefined,
				},
			])
		})

		it('removeAllAssociations() clears every group for the node', async () => {
			const zwave = realZwave()
			;(zwave as any)._driver = fakeAssociationDriver([2, 3, 4], {
				2: { 1: [{ nodeId: 3 }], 2: [{ nodeId: 4 }] },
			})

			await zwave.removeAllAssociations(2)

			expect(await zwave.getAssociations(2)).toEqual([])
		})

		it('removeNodeFromAllAssociations() removes the target node from every source/group it belonged to', async () => {
			const zwave = realZwave()
			;(zwave as any)._driver = fakeAssociationDriver([2, 3], {
				2: { 1: [{ nodeId: 3 }] },
			})

			await zwave.removeNodeFromAllAssociations(3)

			expect(await zwave.getAssociations(2)).toEqual([])
		})
	})

	describe('group CRUD facade (ZwaveClient.ts:2594-2621) - real GroupService + jsonStore wiring, with _getGroups() reading the live registry after each mutation', () => {
		function fakeGroupDriver(nodeIds: number[]) {
			return {
				controller: {
					ownNodeId: 1,
					nodes: new Map(nodeIds.map((id) => [id, {}])),
					getMulticastGroup: () => ({
						getDefinedValueIDs: () => [],
					}),
				},
			}
		}

		it('_createGroup() validates node ids against the real driver port, persists via the real jsonStore-backed port, and _getGroups() reflects it', async () => {
			const zwave = realZwave()
			zwave.driverReady = true
			;(zwave as any)._driver = fakeGroupDriver([10, 11])
			// Isolate from any group state a previous test in this file left in the shared harness's jsonStore (see file doc comment)
			;(zwave as any)._groupService._groups = []

			const group = await zwave._createGroup('Kitchen', [10, 11])

			expect(group).toEqual({
				id: 0x1000,
				name: 'Kitchen',
				nodeIds: [10, 11],
			})
			expect(zwave._getGroups()).toEqual([group])

			const persisted = JSON.parse(
				readFileSync(
					path.join(getTestStoreDir(), 'groups.json'),
					'utf8',
				),
			)
			expect(persisted).toEqual([group])
		})

		it('_updateGroup() updates the persisted group, refreshes the multicast instance, and _getGroups() reflects the change', async () => {
			const zwave = realZwave()
			zwave.driverReady = true
			;(zwave as any)._driver = fakeGroupDriver([10, 11, 12])
			;(zwave as any)._groupService._groups = [
				{ id: 0x1000, name: 'Old name', nodeIds: [10, 11] },
			]

			const updated = await zwave._updateGroup(
				0x1000,
				'New name',
				[10, 12],
			)

			expect(updated).toEqual({
				id: 0x1000,
				name: 'New name',
				nodeIds: [10, 12],
			})
			expect(zwave._getGroups()).toEqual([updated])

			const persisted = JSON.parse(
				readFileSync(
					path.join(getTestStoreDir(), 'groups.json'),
					'utf8',
				),
			)
			expect(persisted).toEqual([updated])
		})

		it('_updateGroup() returns null for an unknown id without persisting anything (real GroupService "not found" branch) - no driver needed', async () => {
			const zwave = realZwave()
			;(zwave as any)._groupService._groups = []

			const result = await zwave._updateGroup(0x9999, 'X', [10, 11])

			expect(result).toBeNull()
		})

		it("_deleteGroup() removes the persisted group; _getGroups() and disk both reflect the deletion (see outboundProducers.test.ts's NODE_REMOVED emission test for the same call's socket side)", async () => {
			const zwave = realZwave()
			;(zwave as any)._groupService._groups = [
				{ id: 0x1000, name: 'To delete', nodeIds: [10, 11] },
			]

			const deleted = await zwave._deleteGroup(0x1000)

			expect(deleted).toBe(true)
			expect(zwave._getGroups()).toEqual([])

			const persisted = JSON.parse(
				readFileSync(
					path.join(getTestStoreDir(), 'groups.json'),
					'utf8',
				),
			)
			expect(persisted).toEqual([])
		})
	})

	describe('virtual node values (ZwaveClient.ts:2719-2773 _buildVirtualValueId, invoked by GroupService._updateVirtualNodeValues) - real ValueMetadata presets from @zwave-js/core, exercised end-to-end through _createGroup()/_updateGroup()', () => {
		function fakeDriverWithDefinedValueIds(
			nodeIds: number[],
			valueIds: VirtualValueID[],
		) {
			return {
				controller: {
					ownNodeId: 1,
					nodes: new Map(nodeIds.map((id) => [id, {}])),
					getMulticastGroup: () => ({
						getDefinedValueIDs: () => valueIds,
					}),
				},
			}
		}

		it('builds full ZUIValueId entries for each real virtual value id, deriving type/readable/writeable/label/commandClassVersion from real zwave-js metadata (boolean + numeric-specific min/max/unit)', async () => {
			const zwave = realZwave()
			zwave.driverReady = true
			;(zwave as any)._driver = fakeDriverWithDefinedValueIds(
				[10, 11],
				[booleanVirtualValueId, numericVirtualValueId],
			)
			;(zwave as any)._groupService._groups = []

			const client = await connectedSubscriber('nodes')
			const updatedWithValues = waitForNodeUpdatedWithValues(client)

			const group = await zwave._createGroup('Kitchen', [10, 11])

			const payload = await updatedWithValues
			expect(payload.values['37-0-currentValue']).toMatchObject({
				id: `${group.id}-37-0-currentValue`,
				nodeId: group.id,
				commandClass: CommandClasses['Binary Switch'],
				commandClassName: 'Binary Switch',
				endpoint: 0,
				property: 'currentValue',
				propertyName: 'currentValue',
				type: 'boolean',
				readable: true,
				writeable: true,
				label: 'Current value',
				commandClassVersion: 2,
				list: false,
			})
			expect(payload.values['38-0-currentValue']).toMatchObject({
				id: `${group.id}-38-0-currentValue`,
				type: 'number',
				min: 0,
				max: 99,
				unit: '%',
				list: false,
				commandClassVersion: 4,
			})
		})

		it('defaults commandClassVersion to 1 when the real zwave-js metadata reports ccVersion 0 (defensive fallback for an older zwave-js build, ZwaveClient.ts:2729-2732)', async () => {
			const zwave = realZwave()
			zwave.driverReady = true
			;(zwave as any)._driver = fakeDriverWithDefinedValueIds(
				[10, 11],
				[{ ...booleanVirtualValueId, ccVersion: 0 }],
			)
			;(zwave as any)._groupService._groups = []

			const client = await connectedSubscriber('nodes')
			const updatedWithValues = waitForNodeUpdatedWithValues(client)

			await zwave._createGroup('Kitchen', [10, 11])

			const payload = await updatedWithValues
			expect(
				payload.values['37-0-currentValue'].commandClassVersion,
			).toBe(1)
		})

		it('omits a virtual value id from the emitted values entirely when its real zwave-js metadata is missing (defensive guard for an older zwave-js build, ZwaveClient.ts:2724-2725), while still emitting the rest', async () => {
			const zwave = realZwave()
			zwave.driverReady = true
			// Simulates an older zwave-js build omitting metadata for a synthesized entry; the cast only satisfies this fake driver's own compile-time return type, a no-op at runtime
			const malformed: Partial<VirtualValueID> = {
				...booleanVirtualValueId,
			}
			delete malformed.metadata
			;(zwave as any)._driver = fakeDriverWithDefinedValueIds(
				[10, 11],
				[malformed as VirtualValueID, numericVirtualValueId],
			)
			;(zwave as any)._groupService._groups = []

			const client = await connectedSubscriber('nodes')
			const updatedWithValues = waitForNodeUpdatedWithValues(client)

			await zwave._createGroup('Kitchen', [10, 11])

			const payload = await updatedWithValues
			expect(payload.values['37-0-currentValue']).toBeUndefined()
			expect(payload.values['38-0-currentValue']).toBeDefined()
		})

		// _buildVirtualValueId (ZwaveClient.ts:2737-2743) merges in any
		// existing valueId fields (e.g. a user-set poll config) before
		// applying the freshly-built ones - mirroring `_updateValueMetadata`'s
		// physical-node behavior. Both real callers of _buildVirtualValueId
		// (GroupService._updateVirtualNodeValues and
		// ZwaveClient._doUpdateBroadcastNodeValues) reset the target
		// ZUINode's `values` to `{}` immediately before the rebuild loop that
		// reads "existing" from that same values map, so the merge can never
		// actually see a prior value through either real call path today -
		// confirmed by attempting this test through _createGroup()/
		// _updateGroup() and observing the merged field always come back
		// undefined. Since it isn't reachable via any real facade/production
		// path, it's intentionally not covered here rather than restoring a
		// private-method-call test for unreachable mechanics.
	})

	describe('startup group restoration (ZwaveClient.ts:5051-5053) - the exact loop _onDriverReady() runs on every driver-ready/restart', () => {
		it('GroupService loads persisted groups from disk at construction time - before any driver-ready restoration logic runs', async () => {
			await harness.jsonStore.put(harness.store.groups, [
				{ id: 0x1000, name: 'Restored on startup', nodeIds: [10, 11] },
			])

			const zwave = realZwave()

			expect(zwave._getGroups()).toEqual([
				{ id: 0x1000, name: 'Restored on startup', nodeIds: [10, 11] },
			])
		})

		it('invoking the exact cited restoration loop materializes a live virtual node + populated ZUINode + NODE_UPDATED for every persisted group - without running the rest of _onDriverReady() (see file doc comment for why)', async () => {
			const zwave = realZwave()
			zwave.driverReady = true
			;(zwave as any)._driver = {
				controller: {
					getMulticastGroup: () => ({
						getDefinedValueIDs: () => [booleanVirtualValueId],
					}),
				},
			}
			;(zwave as any)._groupService._groups = [
				{ id: 0x1000, name: 'Restored', nodeIds: [10, 11] },
			]

			const client = await connectedSubscriber('nodes')
			const updatedWithValues = waitForNodeUpdatedWithValues(client)

			// The exact 2-statement loop at ZwaveClient.ts:5051-5053, run
			// through the real, currently-wired GroupService instance.
			for (const group of zwave._getGroups()) {
				;(zwave as any)._groupService.createVirtualNode(group)
			}

			expect((zwave as any)._virtualNodes.has(0x1000)).toBe(true)
			expect((zwave as any)._nodes.get(0x1000)).toMatchObject({
				kind: 'multicast',
				virtual: true,
			})

			const payload = await updatedWithValues
			expect(payload.values['37-0-currentValue']).toMatchObject({
				id: '4096-37-0-currentValue',
				nodeId: 0x1000,
				type: 'boolean',
			})
		})
	})

	describe('node removal (ZwaveClient.ts:5442-5446)', () => {
		it('_onNodeRemoved() removes the physical node and persists its removal from every affected group, through the real GroupService', async () => {
			await harness.jsonStore.put(harness.store.groups, [
				{ id: 0x1000, name: 'G', nodeIds: [10, 11, 12] },
			])

			const zwave = realZwave()
			zwave.driverReady = true
			;(zwave as any).storeNodes = {}
			;(zwave as any)._driver = {
				controller: {
					supportsLongRange: false,
					nodes: new Map(),
					getMulticastGroup: () => ({ getDefinedValueIDs: () => [] }),
				},
			}
			;(zwave as any)._nodes.set(11, {
				id: 11,
				name: 'Removed physical node',
			})

			const fakeZwaveNode: any = { id: 11, removeAllListeners: vi.fn() }
			await (zwave as any)._onNodeRemoved(
				fakeZwaveNode,
				RemoveNodeReason.Excluded,
			)

			expect((zwave as any)._nodes.has(11)).toBe(false)
			expect(zwave._getGroups()).toEqual([
				{ id: 0x1000, name: 'G', nodeIds: [10, 12] },
			])

			const persisted = JSON.parse(
				readFileSync(
					path.join(getTestStoreDir(), 'groups.json'),
					'utf8',
				),
			)
			expect(persisted).toEqual([
				{ id: 0x1000, name: 'G', nodeIds: [10, 12] },
			])
		})
	})

	describe('socket projection: group virtual-node values use real, valid VirtualValueID shapes end-to-end', () => {
		it('_createGroup() rebuilds group values through the real _buildVirtualValueId() pipeline and projects them via a single NODE_UPDATED (not a per-value VALUE_UPDATED - groupSocketPort.emitValueChanged only emits the internal event, see ZwaveClient.ts:1138-1142), while still feeding that internal valueChanged event for MQTT/HASS', async () => {
			const zwave = realZwave()
			zwave.driverReady = true
			;(zwave as any)._driver = {
				controller: {
					ownNodeId: 1,
					nodes: new Map([
						[10, {}],
						[11, {}],
					]),
					getMulticastGroup: () => ({
						getDefinedValueIDs: () => [booleanVirtualValueId],
					}),
				},
			}
			;(zwave as any)._groupService._groups = []

			const client = await connectedSubscriber('nodes')
			const sendToSocketSpy = vi.spyOn(zwave as any, 'sendToSocket')
			const updatedWithValues = waitForNodeUpdatedWithValues(client)
			// No cast needed: TypedEventEmitter.once() infers valueId/node/changed
			// as the real ZUIValueId/ZUINode/boolean types from the
			// 'valueChanged' event signature; only the Promise's own result
			// type is spelled out, since inference doesn't flow back through
			// the nested once() callback
			const internalValueChanged = new Promise<{
				valueId: ZUIValueId
				node: ZUINode
				changed?: boolean
			}>((resolve) =>
				zwave.once('valueChanged', (valueId, node, changed) =>
					resolve({ valueId, node, changed }),
				),
			)

			const group = await zwave._createGroup('Kitchen lights', [10, 11])

			const payload = await updatedWithValues
			expect(payload.id).toBe(group.id)
			expect(payload.values['37-0-currentValue']).toMatchObject({
				id: `${group.id}-37-0-currentValue`,
				nodeId: group.id,
				type: 'boolean',
				commandClass: CommandClasses['Binary Switch'],
			})

			const { valueId, node, changed } = await internalValueChanged
			expect(valueId.id).toBe(`${group.id}-37-0-currentValue`)
			expect(node.id).toBe(group.id)
			expect(changed).toBe(true)

			// Asserting the spy's full call history (not a timed wait) proves no VALUE_UPDATED was ever sent, deterministically
			const socketEventNames = sendToSocketSpy.mock.calls.map(
				(call) => call[0],
			)
			expect(socketEventNames).not.toContain(socketEvents.valueUpdated)
			expect(socketEventNames).toContain(socketEvents.nodeUpdated)
		})
	})
})
