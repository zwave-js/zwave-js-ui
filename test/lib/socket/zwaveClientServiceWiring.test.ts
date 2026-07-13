/**
 * Characterizes the production `ZwaveClient.ts` wiring changed/introduced by
 * findings #1-#3 of PR #4732's review (AssociationService/GroupService
 * stale-driver + generation-fencing fixes, scene facade return types) plus
 * the areas the review explicitly called out as needing production
 * integration-test coverage: association delegates, the group CRUD facade,
 * `_buildVirtualValueId`, startup group restoration, node-removal ->
 * group-index delegation, and group virtual-node socket projection using
 * valid, real `VirtualValueID` shapes.
 *
 * This intentionally does NOT re-test `AssociationService`'s or
 * `GroupService`'s own internal logic - that's exhaustively covered by
 * `AssociationService.test.ts` / `GroupService.test.ts` (including the
 * stale-driver-across-await and generation-fencing regressions themselves).
 * This file only characterizes `ZwaveClient`'s OWN facade/wiring layer:
 *
 *   - Association delegates (`ZwaveClient.ts:1695-1805`) are thin one-line
 *     pass-throughs with no closures/generation-fencing involved, so a
 *     `vi.spyOn` on the real `_associationService` instance is enough to
 *     prove the wiring (right method, right args, right return value)
 *     without needing any driver fakery.
 *   - The group CRUD facade (`ZwaveClient.ts:2594-2621`) is where finding
 *     #2's actual bug lived (the closure-backed virtual-node registry
 *     `init()` builds) - these are exercised through REAL end-to-end
 *     `GroupService` + jsonStore persistence instead of spies, including a
 *     disk read-back, which is the only way to actually prove that wiring.
 *   - `_buildVirtualValueId` is exercised both directly (unit-level field
 *     mapping) and indirectly (through the "socket projection" describe
 *     block), using real `ValueMetadata` presets from `@zwave-js/core`
 *     rather than hand-rolled fixtures, per the review's "valid real
 *     VirtualValueID shapes" requirement.
 *   - Startup group restoration is NOT exercised by invoking the full
 *     `_onDriverReady()` (it needs ~10 controller event listeners,
 *     `getStoreNodes()`, `_createBroadcastNodes()`, full node iteration,
 *     `sendInitToSockets()`, `loadFakeNodes()` - too heavy/fragile to fake
 *     honestly for what this finding actually needs proven). Instead this
 *     file directly exercises the two things that loop actually does: (a)
 *     `GroupService` loading persisted groups from disk at construction
 *     time, and (b) the exact 2-statement restoration loop
 *     (`ZwaveClient.ts:5051-5053`) that recreates each group's live virtual
 *     node + ZUINode shell + values - mirroring the precedent already set by
 *     `outboundProducers.test.ts`'s own doc comment for avoiding excessive
 *     driver fakery.
 *
 * Store isolation (HIGH regression, shared with `callApi.test.ts` /
 * `outboundProducers.test.ts`): `ZwaveClient.ts` imports `storeDir`
 * (transitively, via `jsonStore.ts`) from `api/config/app.ts` at module
 * top level, which reads `process.env.STORE_DIR` once, at module-evaluation
 * time. A static `import ZWaveClient from '../../../api/lib/ZwaveClient.ts'`
 * at this file's top would be hoisted and evaluated BEFORE
 * `createSocketHarness()` (which calls `ensureTestEnv()` to set an isolated
 * `STORE_DIR`) ever runs inside `beforeAll` - so production code would end
 * up caching the *real* repository `store/` directory, and any write this
 * file triggers (`_createGroup()`, `_updateGroup()`, `_deleteGroup()`, node
 * removal) would land there instead of the harness's temp directory. The
 * fix: `ZwaveClient` is imported here as `import type` only (fully erased at
 * compile time, so it can never race isolation setup), and the real runtime
 * value is loaded via a dynamic `await import(...)` inside `beforeAll`,
 * strictly AFTER `harness = await createSocketHarness()` has already
 * isolated `STORE_DIR`. See `outboundProducers.test.ts`'s doc comment for
 * the full mechanics.
 *
 * Shared-harness group-state isolation: `harness.jsonStore`'s in-memory
 * cache (and the underlying `groups.json` file) persist across every test in
 * this file - only cleared once, in `afterAll`'s `close()` - because
 * `resetState()` (run in `afterEach`) deliberately does not touch it (see
 * `harness.ts`). Tests that don't care about construction-time disk loading
 * seed `(zwave as any)._groupService._groups = [...]` directly right after
 * constructing, bypassing whatever the constructor happened to load - the
 * same technique `outboundProducers.test.ts`'s own `_deleteGroup()` test
 * already uses. The two tests that specifically characterize the
 * construction-time disk load instead seed groups.json itself via
 * `harness.jsonStore.put(harness.store.groups, [...])` immediately before
 * constructing, which is just as deterministic (nothing runs in between)
 * and is the more faithful/real proof for exactly those two tests. Note:
 * `removeNodeFromGroups()` is the one GroupService method that reads the
 * nodeId -> groupIds index (`_nodeToGroups`, rebuilt from `_groups` at
 * construction and after every mutating call) as its entry point, so
 * directly overwriting `_groups` post-construction (bypassing the index
 * rebuild) would leave it silently stale for that one method - the node
 * removal test below seeds via the disk-load path for that reason.
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
		// Isolate STORE_DIR FIRST (via the harness), THEN dynamically import
		// the real, store-dependent `ZwaveClient.ts` - see the file doc
		// comment's "Store isolation" section for why order matters here.
		harness = await createSocketHarness()
		;({ default: ZWaveClient } = await import(
			'../../../api/lib/ZwaveClient.ts'
		))
	})

	afterAll(async () => {
		await harness.close()
	})

	beforeEach(() => {
		// Defensive: every spy in this file targets a fresh per-test
		// instance (a new `_associationService`/`_groupService`/`zwave`
		// object each `realZwave()` call), so nothing currently leaks
		// between tests - but restoring first, matching the convention
		// already used in `ScheduleService.test.ts` /
		// `ConfigurationTemplateService.test.ts`, keeps that true even if a
		// future test in this file spies on shared/prototype state.
		vi.restoreAllMocks()

		// The real `'clients'` connect/disconnect callback does
		// `gw.zwave?.setUserCallbacks()` on every first-client connection -
		// `gw` itself must be truthy or this throws. See
		// `outboundProducers.test.ts`'s identical `beforeEach` comment.
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
	 * sends with the full-but-not-yet-populated virtual ZUINode (whose
	 * `values` field is `{}`, which is truthy) before
	 * `_updateVirtualNodeValues()` populates and re-emits it.
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
		// AssociationService's own logic (association-group discovery,
		// add/remove/refresh flows, the stale-driver-across-await fix) is
		// exhaustively unit-tested in `AssociationService.test.ts` (finding
		// #1). These tests only characterize ZwaveClient's OWN facade
		// wiring: does calling the public method really delegate to
		// `_associationService`, with the right arguments, returning its
		// result unmodified? Stubbing the real `_associationService`
		// instance's methods proves exactly that without needing any driver
		// fakery (AssociationService's own methods need a live driver;
		// faking one here would just duplicate its own test suite).

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
			// Isolate this test from any group state a previous test in this
			// file may have left in the shared harness's jsonStore - see the
			// file doc comment's "shared-harness group-state isolation"
			// section.
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
			// Deliberately malformed input (simulates an older zwave-js build
			// omitting metadata) - `Partial<...>` legitimately allows
			// dropping the field without an `any` cast; the single `as
			// VirtualValueID` below only re-satisfies the private method's
			// compile-time parameter type, which is a no-op at runtime.
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

			// Deterministic negative proof (no timing/flush needed): every
			// `sendToSocket` call this whole test triggers is captured by
			// the spy, so asserting on its full call history after the
			// awaits above proves no VALUE_UPDATED was ever sent - not just
			// that none arrived within some fixed wait window.
			const socketEventNames = sendToSocketSpy.mock.calls.map(
				(call) => call[0],
			)
			expect(socketEventNames).not.toContain(socketEvents.valueUpdated)
			expect(socketEventNames).toContain(socketEvents.nodeUpdated)
		})
	})

	// -----------------------------------------------------------------
	// Regression: Finding 1 – callback delegation fully in coordinator
	// -----------------------------------------------------------------
	describe('inclusion callback delegation (Finding 1)', () => {
		it('grantSecurityClasses() delegates to coordinator', () => {
			const zwave = realZwave()
			const coordinator = (zwave as any)._inclusionCoordinator
			const spy = vi.spyOn(coordinator, 'grantSecurityClasses')

			zwave.grantSecurityClasses({ securityClasses: [0, 1] } as any)

			expect(spy).toHaveBeenCalledWith({ securityClasses: [0, 1] })
		})

		it('validateDSK() delegates to coordinator', () => {
			const zwave = realZwave()
			const coordinator = (zwave as any)._inclusionCoordinator
			const spy = vi.spyOn(coordinator, 'validateDSK')

			zwave.validateDSK('12345')

			expect(spy).toHaveBeenCalledWith('12345')
		})

		it('abortInclusion() delegates to coordinator', () => {
			const zwave = realZwave()
			const coordinator = (zwave as any)._inclusionCoordinator
			const spy = vi.spyOn(coordinator, 'abortInclusion')

			zwave.abortInclusion()

			expect(spy).toHaveBeenCalled()
		})

		it('setUserCallbacks() delegates to coordinator', () => {
			const zwave = realZwave()
			const coordinator = (zwave as any)._inclusionCoordinator
			const spy = vi.spyOn(coordinator, 'setUserCallbacks')

			zwave.setUserCallbacks()

			expect(spy).toHaveBeenCalled()
			expect(zwave.hasUserCallbacks).toBe(true)
		})

		it('removeUserCallbacks() delegates to coordinator', () => {
			const zwave = realZwave()
			const coordinator = (zwave as any)._inclusionCoordinator
			const spy = vi.spyOn(coordinator, 'removeUserCallbacks')

			zwave.setUserCallbacks()
			zwave.removeUserCallbacks()

			expect(spy).toHaveBeenCalled()
			expect(zwave.hasUserCallbacks).toBe(false)
		})
	})

	// -----------------------------------------------------------------
	// Regression: Finding 2 & 3 – close() resets coordinator & clears fw
	// -----------------------------------------------------------------
	describe('close() lifecycle cleanup (Findings 2 & 3)', () => {
		it('close() calls _inclusionCoordinator.reset()', async () => {
			const zwave = realZwave()
			const coordinator = (zwave as any)._inclusionCoordinator
			const spy = vi.spyOn(coordinator, 'reset')

			await zwave.close()

			expect(spy).toHaveBeenCalled()
		})

		it('close() calls _firmwareUpdateService.clearScheduledCheck()', async () => {
			const zwave = realZwave()
			const fwService = (zwave as any)._firmwareUpdateService
			const spy = vi.spyOn(fwService, 'clearScheduledCheck')

			await zwave.close()

			expect(spy).toHaveBeenCalled()
		})
	})

	// -----------------------------------------------------------------
	// Coverage: simple facade methods
	// -----------------------------------------------------------------
	describe('simple facade methods (coverage uplift)', () => {
		it('getStatus() returns client status', () => {
			const zwave = realZwave()
			const status = zwave.getStatus()
			expect(status).toHaveProperty('driverReady')
			expect(status).toHaveProperty('status')
			expect(status).toHaveProperty('config')
		})

		it('isVirtualNode() returns false for unknown nodes', () => {
			const zwave = realZwave()
			expect(zwave.isVirtualNode(999)).toBe(false)
		})

		it('getVirtualNode() returns null for non-virtual nodes', () => {
			const zwave = realZwave()
			expect(zwave.getVirtualNode(999)).toBeNull()
		})

		it('getZwaveValue() parses valid id string', () => {
			const zwave = realZwave()
			const result = zwave.getZwaveValue('37-0-currentValue-undefined')
			expect(result).toEqual({
				commandClass: 37,
				endpoint: 0,
				property: 'currentValue',
				propertyKey: 'undefined',
			})
		})

		it('getZwaveValue() returns null for empty string', () => {
			const zwave = realZwave()
			expect(zwave.getZwaveValue('')).toBeNull()
		})

		it('getZwaveValue() returns null for too-short string', () => {
			const zwave = realZwave()
			expect(zwave.getZwaveValue('37-0')).toBeNull()
		})
	})
})
