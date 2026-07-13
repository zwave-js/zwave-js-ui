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
 * (and node removal, which reads an index only rebuilt from `_groups` at
 * construction) seed `groups.json` itself beforehand instead.
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

	describe('association delegates (ZwaveClient.ts:1695-1805) - thin pass-through wiring to the real, independently-tested AssociationService', () => {
		// Stubbing the real _associationService instance's methods proves delegation without needing driver fakery, which AssociationService's own tests already require

		it('getAssociations() delegates to AssociationService.getAssociations(nodeId, refresh) and returns its result', async () => {
			const zwave = realZwave()
			const expected = [
				{
					endpoint: 0,
					groupId: 1,
					nodeId: 5,
					targetEndpoint: undefined,
				},
			]
			const spy = vi
				.spyOn((zwave as any)._associationService, 'getAssociations')
				.mockResolvedValue(expected)

			const result = await zwave.getAssociations(5, true)

			expect(spy).toHaveBeenCalledOnce()
			expect(spy).toHaveBeenCalledWith(5, true)
			expect(result).toBe(expected)
		})

		it('checkAssociation() delegates to AssociationService.checkAssociation(source, groupId, association) and returns its result', () => {
			const zwave = realZwave()
			const source = { nodeId: 1 }
			const association = { nodeId: 2 }
			const spy = vi
				.spyOn((zwave as any)._associationService, 'checkAssociation')
				.mockReturnValue(AssociationCheckResult.OK)

			const result = zwave.checkAssociation(source, 3, association)

			expect(spy).toHaveBeenCalledOnce()
			expect(spy).toHaveBeenCalledWith(source, 3, association)
			expect(result).toBe(AssociationCheckResult.OK)
		})

		it('addAssociations() delegates to AssociationService.addAssociations(source, groupId, associations, options) and returns its result', async () => {
			const zwave = realZwave()
			const source = { nodeId: 1 }
			const associations = [{ nodeId: 2 }]
			const expected = [AssociationCheckResult.OK]
			const spy = vi
				.spyOn((zwave as any)._associationService, 'addAssociations')
				.mockResolvedValue(expected)

			const result = await zwave.addAssociations(
				source,
				3,
				associations,
				{
					force: true,
				},
			)

			expect(spy).toHaveBeenCalledOnce()
			expect(spy).toHaveBeenCalledWith(source, 3, associations, {
				force: true,
			})
			expect(result).toBe(expected)
		})

		it('removeAssociations() delegates to AssociationService.removeAssociations(source, groupId, associations)', async () => {
			const zwave = realZwave()
			const source = { nodeId: 1 }
			const associations = [{ nodeId: 2 }]
			const spy = vi
				.spyOn((zwave as any)._associationService, 'removeAssociations')
				.mockResolvedValue(undefined)

			await zwave.removeAssociations(source, 3, associations)

			expect(spy).toHaveBeenCalledOnce()
			expect(spy).toHaveBeenCalledWith(source, 3, associations)
		})

		it('removeAllAssociations() delegates to AssociationService.removeAllAssociations(nodeId)', async () => {
			const zwave = realZwave()
			const spy = vi
				.spyOn(
					(zwave as any)._associationService,
					'removeAllAssociations',
				)
				.mockResolvedValue(undefined)

			await zwave.removeAllAssociations(7)

			expect(spy).toHaveBeenCalledOnce()
			expect(spy).toHaveBeenCalledWith(7)
		})

		it('removeNodeFromAllAssociations() delegates to AssociationService.removeNodeFromAllAssociations(nodeId)', async () => {
			const zwave = realZwave()
			const spy = vi
				.spyOn(
					(zwave as any)._associationService,
					'removeNodeFromAllAssociations',
				)
				.mockResolvedValue(undefined)

			await zwave.removeNodeFromAllAssociations(7)

			expect(spy).toHaveBeenCalledOnce()
			expect(spy).toHaveBeenCalledWith(7)
		})
	})

	describe('group CRUD facade (ZwaveClient.ts:2594-2621) - real GroupService + jsonStore wiring (the closure-backed registry finding #2 fixed)', () => {
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

		it('_getGroups() delegates to GroupService.getGroups(), returning the exact same array reference', () => {
			const zwave = realZwave()
			const groups = [{ id: 0x1000, name: 'G', nodeIds: [10, 11] }]
			;(zwave as any)._groupService._groups = groups

			expect(zwave._getGroups()).toBe(groups)
		})
	})

	describe('_buildVirtualValueId (ZwaveClient.ts:2750-2804) - real ValueMetadata presets from @zwave-js/core', () => {
		it('builds a full ZUIValueId from a real boolean VirtualValueID, deriving id/type/readable/writeable/label/commandClassVersion from real zwave-js metadata', () => {
			const zwave = realZwave()

			const result = (zwave as any)._buildVirtualValueId(
				0x1000,
				booleanVirtualValueId,
				true,
			)

			expect(result).toMatchObject({
				id: '4096-37-0-currentValue',
				nodeId: 0x1000,
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
				value: true,
				list: false,
			})
		})

		it('builds a full ZUIValueId from a real numeric VirtualValueID, applying numeric-specific fields (min/max/unit) via _applyValueMetadataFields', () => {
			const zwave = realZwave()

			const result = (zwave as any)._buildVirtualValueId(
				0x1000,
				numericVirtualValueId,
				42,
			)

			expect(result).toMatchObject({
				id: '4096-38-0-currentValue',
				type: 'number',
				min: 0,
				max: 99,
				unit: '%',
				value: 42,
				list: false,
				commandClassVersion: 4,
			})
		})

		it('defaults commandClassVersion to 1 when ccVersion is 0 (defensive fallback documented at ZwaveClient.ts:2758-2763)', () => {
			const zwave = realZwave()

			const result = (zwave as any)._buildVirtualValueId(
				0x1000,
				{ ...booleanVirtualValueId, ccVersion: 0 },
				false,
			)

			expect(result.commandClassVersion).toBe(1)
		})

		it('returns null when the VirtualValueID carries no metadata (ZwaveClient.ts:2755-2756 guard)', () => {
			const zwave = realZwave()
			// Simulates an older zwave-js build omitting metadata; the `as VirtualValueID` cast only satisfies the private method's compile-time param type, a no-op at runtime
			const malformed: Partial<VirtualValueID> = {
				...booleanVirtualValueId,
			}
			delete malformed.metadata

			const result = (zwave as any)._buildVirtualValueId(
				0x1000,
				malformed as VirtualValueID,
				true,
			)

			expect(result).toBeNull()
		})

		it('preserves existing fields from a previously-built value id when rebuilding (ZwaveClient.ts:2765-2771 merge)', () => {
			const zwave = realZwave()
			;(zwave as any)._nodes.set(0x1000, {
				id: 0x1000,
				values: {
					'37-0-currentValue': { isCurrentValue: true },
				},
			})

			const result = (zwave as any)._buildVirtualValueId(
				0x1000,
				booleanVirtualValueId,
				true,
			)

			expect(result.isCurrentValue).toBe(true)
		})
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

	describe('node removal delegates group cleanup to GroupService (ZwaveClient.ts:5442-5446)', () => {
		it('_onNodeRemoved() removes the physical node AND delegates to the real GroupService.removeNodeFromGroups(), which persists the removal from every affected group', async () => {
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

			const removeNodeFromGroupsSpy = vi.spyOn(
				(zwave as any)._groupService,
				'removeNodeFromGroups',
			)

			const fakeZwaveNode: any = { id: 11, removeAllListeners: vi.fn() }
			await (zwave as any)._onNodeRemoved(
				fakeZwaveNode,
				RemoveNodeReason.Excluded,
			)

			expect((zwave as any)._nodes.has(11)).toBe(false)
			expect(removeNodeFromGroupsSpy).toHaveBeenCalledOnce()
			expect(removeNodeFromGroupsSpy).toHaveBeenCalledWith(11)
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
			const internalValueChanged = new Promise<unknown[]>((resolve) =>
				zwave.once('valueChanged', (...args: unknown[]) =>
					resolve(args),
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

			const [valueId, node, changed] = await internalValueChanged
			expect((valueId as any).id).toBe(`${group.id}-37-0-currentValue`)
			expect((node as any).id).toBe(group.id)
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
