/**
 * Characterizes: every one of the 24 outbound (server -> client) producer
 * call sites in `api/lib/ZwaveClient.ts` / `api/lib/ZnifferManager.ts` /
 * `api/app.ts` - literal event name, payload shape, argument count/order,
 * channel routing, and `process.nextTick` deferral where the real code
 * defers.
 *
 * `ZwaveClient.sendToSocket` (private) is the single shared routing point
 * for ~21 of the 24 events (`api/lib/ZwaveClient.ts:2659`): it looks up
 * `eventToChannel[evtName]` and either room-routes
 * (`this.socket.to(channel).emit(...)`, deferred one `process.nextTick`)
 * or falls back to an unrouted broadcast with a warning log. A REAL
 * `ZWaveClient` instance is used throughout (safe to construct directly -
 * its constructor only touches `jsonStore`, never a real driver/serial
 * port, as long as `.connect()` is never called - see `callApi.test.ts`
 * for the same technique applied to `callApi`), with `this.socket` pointed
 * at the harness's real `io` so routing is proven against the real
 * Socket.IO adapter, not a mock.
 *
 * Where a call site is reachable through a real PUBLIC (or underscore-
 * "public contract", see `callApi.test.ts`) method - or through its real
 * PRIVATE `_on*` driver-event handler, invoked directly the same way
 * zwave-js's own driver would invoke it - without needing a full driver
 * graph, this file calls that real method/handler so the PAYLOAD itself is
 * exercised too, not just the literal/routing. Where a call site sits deep
 * inside driver-dependent logic that would need a full fake `zwave-js`
 * `Driver`/`ZWaveNode` graph to reach honestly (inclusion result dumping,
 * value metadata parsing, health-check/route-rebuild progress plumbing
 * owned by the `zwave-js` package itself), this file instead drives
 * `sendToSocket` directly with the exact payload shape copied from that
 * call site's source (cited in each test's comment, with an explicit note
 * on why it isn't reached through its real caller) - still proving the
 * real routing mechanism + the real literal, without fabricating driver
 * state that would make the test more fragile than informative.
 *
 * Store isolation (HIGH regression, shared with `callApi.test.ts`): this
 * file drives BOTH `ZwaveClient` and `ZnifferManager`, and both modules
 * import `storeDir`/`logsDir` from `api/config/app.ts` at their own top
 * level (`ZwaveClient.ts` via `jsonStore.ts`, `ZnifferManager.ts:13,42-43`
 * directly). `api/config/app.ts` reads `process.env.STORE_DIR` once, at
 * module-evaluation time. A static
 * `import ZWaveClient from '../../../api/lib/ZwaveClient.ts'` (or
 * `ZnifferManager`) at this file's top is hoisted and evaluated BEFORE
 * `createSocketHarness()` (which calls `ensureTestEnv()` to set an
 * isolated `STORE_DIR`) ever runs inside `beforeAll` - so the real
 * production code would end up caching the *real* repository `store/`
 * directory, and any write this file triggers (e.g. `_deleteGroup()`,
 * `updateStoreNodes()`) would land there instead of the harness's
 * temp directory. The fix: both classes are imported here as `import
 * type` only (type-only imports are fully erased at compile time - zero
 * runtime import, so they can never race isolation setup), and the real
 * runtime values are loaded via a dynamic `await import(...)` inside
 * `beforeAll`, strictly AFTER `harness = await createSocketHarness()` has
 * already isolated `STORE_DIR` and (transitively, via `api/app.ts`)
 * already evaluated `api/config/app.ts` once, correctly. See
 * `callApi.test.ts`'s doc comment for the full mechanics, and its
 * `store-write isolation regression` describe block for a dedicated,
 * standalone proof.
 */
import {
	describe,
	it,
	expect,
	beforeAll,
	beforeEach,
	afterAll,
	afterEach,
	vi,
} from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { NODE_ID_BROADCAST_LR } from '@zwave-js/core'
import { Zniffer } from 'zwave-js'
import type ZWaveClientType from '../../../api/lib/ZwaveClient.ts'
import type ZnifferManagerType from '../../../api/lib/ZnifferManager.ts'
import { eventToChannel } from '../../../api/lib/SocketEvents.ts'
import { buffer2hex } from '../../../api/lib/utils.ts'
import { createSocketHarness, type SocketHarness } from './harness.ts'
import { createFakeGateway } from './fakes.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '../../..')

describe('Socket contract: outbound producers', () => {
	let harness: SocketHarness
	let ZWaveClient: typeof ZWaveClientType
	let ZnifferManager: typeof ZnifferManagerType

	beforeAll(async () => {
		// Isolate STORE_DIR FIRST (via the harness), THEN dynamically
		// import the real, store-dependent `ZwaveClient.ts`/
		// `ZnifferManager.ts` modules - see the file doc comment's "Store
		// isolation" section for why order matters here.
		harness = await createSocketHarness()
		;({ default: ZWaveClient } = await import(
			'../../../api/lib/ZwaveClient.ts'
		))
		;({ default: ZnifferManager } = await import(
			'../../../api/lib/ZnifferManager.ts'
		))
	})

	afterAll(async () => {
		await harness.close()
	})

	beforeEach(() => {
		// The real `'clients'` connect/disconnect callback
		// (`api/app.ts`'s `socketManager.on('clients', ...)`) does
		// `gw.zwave?.setUserCallbacks()` on every first-client connection -
		// `gw` itself (not just `gw.zwave`) must be truthy or this throws,
		// so every test in this file (which connects real clients but
		// never drives the gateway) needs a benign stub installed. See
		// `clientLifecycle.test.ts` for the dedicated characterization of
		// this callback itself.
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

	/** Subscribes `client` to `channel` and resolves once the ack lands. */
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

	/**
	 * Resolves with the payload the NEXT time `event` is received on
	 * `client` - deterministic, event-driven (no fixed sleep window).
	 * Every positive "this real payload was delivered" assertion in this
	 * file awaits this instead of a timer, so it can never be flaky under
	 * load and never needs a longer/shorter guess at how long delivery
	 * takes.
	 */
	function waitForEvent<T = unknown>(client: any, event: string): Promise<T> {
		return new Promise((resolve) => client.once(event, resolve))
	}

	/**
	 * Like `waitForEvent`, but captures ALL arguments the event was
	 * emitted with (not just the first) - for the handful of real events
	 * that pass more than one positional argument (e.g. `NODE_UPDATED`'s
	 * `(node, isPartial)`).
	 */
	function waitForArgs(client: any, event: string): Promise<unknown[]> {
		return new Promise((resolve) =>
			client.once(event, (...args: unknown[]) => resolve(args)),
		)
	}

	describe('sendToSocket mechanics (shared by ~21 of the 24 events)', () => {
		it('routes to eventToChannel[event] and defers the actual emit via process.nextTick', async () => {
			const zwave = realZwave()
			const client = await connectedSubscriber('nodes')
			const received = waitForEvent(client, 'NODE_ADDED')

			// Spy on the real, in-process `io.to(...)` call `sendToSocket`
			// uses to route - this proves the nextTick deferral directly
			// (same event loop turn, no network round-trip involved),
			// rather than inferring it from wire-delivery timing.
			const toSpy = vi.spyOn(harness.io, 'to')
			;(zwave as any).sendToSocket('NODE_ADDED', { node: { id: 9 } })
			expect(toSpy).not.toHaveBeenCalled()

			// Wait for exactly the next process.nextTick turn.
			await new Promise<void>((resolve) => process.nextTick(resolve))
			expect(toSpy).toHaveBeenCalledWith('nodes')
			toSpy.mockRestore()

			expect(eventToChannel.NODE_ADDED).toBe('nodes')
			expect(await received).toEqual({ node: { id: 9 } })
		})

		it('falls back to an unrouted broadcast for an event with no channel mapping', async () => {
			const zwave = realZwave()
			const client = harness.createClient()
			await harness.connectClient(client)
			// Deliberately NOT subscribed to any channel - the broadcast
			// fallback (`this.socket.emit(...)`, no room) must still reach
			// it, unlike the routed case above.
			const received = waitForEvent(client, 'SOME_UNMAPPED_EVENT')

			expect(eventToChannel.SOME_UNMAPPED_EVENT).toBeUndefined()
			;(zwave as any).sendToSocket('SOME_UNMAPPED_EVENT', {
				hello: 'world',
			})

			expect(await received).toEqual({ hello: 'world' })
		})

		it('passes every extra argument through, in order, after the payload', async () => {
			const zwave = realZwave()
			const client = await connectedSubscriber('nodes')
			const received = waitForArgs(client, 'NODE_UPDATED')
			;(zwave as any).sendToSocket(
				'NODE_UPDATED',
				{ id: 2 },
				true,
				'extra-arg',
			)

			expect(await received).toEqual([{ id: 2 }, true, 'extra-arg'])
		})
	})

	describe('real producer methods', () => {
		it('emitValueChanged() sends VALUE_UPDATED with the mutated valueId when changed=true (ZwaveClient.ts:2699)', async () => {
			const zwave = realZwave()
			;(zwave as any)._driver = {
				controller: { nodes: { get: () => undefined } },
			}
			const client = await connectedSubscriber('values')
			const received = waitForEvent<any>(client, 'VALUE_UPDATED')

			const valueId: any = { nodeId: 2, commandClass: 37, property: 'x' }
			zwave.emitValueChanged(valueId, { id: 2 } as any, true)

			const data = await received
			expect(data.nodeId).toBe(2)
			expect(data.lastUpdate).toEqual(expect.any(Number))
		})

		it('emitValueChanged() sends nothing when changed=false', async () => {
			const zwave = realZwave()
			;(zwave as any)._driver = {
				controller: { nodes: { get: () => undefined } },
			}
			const client = await connectedSubscriber('values')
			const box: unknown[] = []
			client.on('VALUE_UPDATED', (data: unknown) => box.push(data))

			zwave.emitValueChanged(
				{ nodeId: 2, commandClass: 37, property: 'x' } as any,
				{ id: 2 } as any,
				false,
			)

			// Barrier/marker: fire a second, distinct, definitely-emitting
			// call on the same channel and await ITS arrival instead of a
			// fixed sleep. A single client's transport delivers in FIFO
			// order, so if the changed=false call above had (incorrectly)
			// emitted anything, it would necessarily have arrived before
			// this marker - proving its absence deterministically.
			const marker = waitForEvent<any>(client, 'VALUE_UPDATED')
			zwave.emitValueChanged(
				{ nodeId: 99, commandClass: 37, property: 'marker' } as any,
				{ id: 99 } as any,
				true,
			)
			await marker

			expect(box).toHaveLength(1)
			expect((box[0] as any).nodeId).toBe(99)
		})

		it('emitStatistics() converts every null prop to false, leaves others untouched (ZwaveClient.ts:2708-2731)', async () => {
			const zwave = realZwave()
			const client = await connectedSubscriber('statistics')
			const received = waitForEvent(client, 'STATISTICS')

			zwave.emitStatistics(
				{ id: 5 } as any,
				{
					statistics: null,
					lastActive: null,
					applicationRoute: { hops: [] } as any,
				} as any,
			)

			expect(await received).toEqual({
				nodeId: 5,
				statistics: false,
				lastActive: false,
				applicationRoute: { hops: [] },
			})
		})

		it('emitNodeUpdate() sends the FULL node with isPartial=false when no changedProps are given (ZwaveClient.ts:2733-2756)', async () => {
			const zwave = realZwave()
			const client = await connectedSubscriber('nodes')
			const received = waitForArgs(client, 'NODE_UPDATED')

			const node = { id: 7, ready: true } as any
			zwave.emitNodeUpdate(node)

			expect(await received).toEqual([node, false])
		})

		it('emitNodeUpdate() sends only changedProps (+id) with isPartial=true for a partial update', async () => {
			const zwave = realZwave()
			const client = await connectedSubscriber('nodes')
			const received = waitForArgs(client, 'NODE_UPDATED')

			const node = { id: 7, ready: true } as any
			zwave.emitNodeUpdate(node, { status: 'alive' } as any)

			expect(await received).toEqual([{ status: 'alive', id: 7 }, true])
		})

		it('_updateControllerStatus() sends CONTROLLER_CMD with status (error/inclusionState default to undefined, stripped over the wire) (ZwaveClient.ts:6589-6598)', async () => {
			const zwave = realZwave()
			const client = await connectedSubscriber('controller')
			const received = waitForEvent(client, 'CONTROLLER_CMD')
			;(zwave as any)._updateControllerStatus('Removing failed node')

			// `error`/`inclusionState` are real fields on the payload
			// object (`this._error`, `this._inclusionState`), but both
			// default to `undefined` on a fresh client - `undefined`-valued
			// object keys are stripped by JSON serialization, so only
			// `status` survives the wire.
			expect(await received).toEqual({ status: 'Removing failed node' })
		})

		it('_updateControllerStatus() is a no-op (no emit) when the status has not actually changed', async () => {
			const zwave = realZwave()
			const client = await connectedSubscriber('controller')
			const box: unknown[] = []
			client.on('CONTROLLER_CMD', (data: unknown) => box.push(data))

			const first = waitForEvent(client, 'CONTROLLER_CMD')
			;(zwave as any)._updateControllerStatus('Idle')
			await first

			// Barrier/marker: repeat the SAME status (expected no-op),
			// then fire a genuinely DIFFERENT status and await THAT
			// instead of a fixed sleep - FIFO per-connection delivery
			// means the repeat's (absent) emit would have arrived first.
			const marker = waitForEvent(client, 'CONTROLLER_CMD')
			;(zwave as any)._updateControllerStatus('Idle')
			;(zwave as any)._updateControllerStatus('Removing failed node')
			await marker

			expect(box).toHaveLength(2)
			expect((box[0] as any).status).toBe('Idle')
			expect((box[1] as any).status).toBe('Removing failed node')
		})

		it("checkForConfigUpdates() sends INFO with getInfo()'s real payload (ZwaveClient.ts:4442-4448)", async () => {
			const zwave = realZwave()
			;(zwave as any)._driver = {
				checkForConfigUpdates: vi.fn(() => Promise.resolve('1.2.3')),
			}
			zwave.driverReady = true
			const client = await connectedSubscriber('controller')
			const received = waitForEvent<any>(client, 'INFO')

			const newVersion = await zwave.checkForConfigUpdates()

			expect(newVersion).toBe('1.2.3')
			const data = await received
			expect(data.appVersion).toEqual(expect.any(String))
			expect(data.zwaveVersion).toEqual(expect.any(String))
		})

		it("_deleteGroup() sends NODE_REMOVED with just {id} (ZwaveClient.ts:3225) - one of NODE_REMOVED's 3 real shapes", async () => {
			const zwave = realZwave()
			zwave.groups = [{ id: 42, name: 'Test group' } as any]
			const client = await connectedSubscriber('nodes')
			const received = waitForEvent(client, 'NODE_REMOVED')

			const deleted = await zwave._deleteGroup(42)

			expect(deleted).toBe(true)
			expect(await received).toEqual({ id: 42 })
		})
	})

	describe('additional real literals/shapes: driven through their real producing method/handler', () => {
		// Each of these calls the REAL private `_on*` driver-event handler
		// (or other real method) that owns the call site cited per test -
		// exercising the real payload-construction logic, not just a
		// hand-copied literal - by giving it the minimal real internal
		// state it reads (documented inline). This directly addresses the
		// "producer tests bypass real producers" finding for every call
		// site cheap enough to reach this way without a full zwave-js
		// `Driver`/`ZWaveNode` fake.

		it('NODE_REMOVED: {id: NODE_ID_BROADCAST_LR} via the real _refreshBroadcastLRNode() deletion branch (ZwaveClient.ts:4088-4096)', async () => {
			const zwave = realZwave()
			zwave.driverReady = true
			;(zwave as any)._driver = {
				controller: { supportsLongRange: false, nodes: new Map() },
			}
			// Pre-populate as if the LR broadcast virtual node already
			// existed - `hasLRNodes` is false (no controller/LR nodes
			// above), so the real method's deletion branch fires.
			;(zwave as any)._virtualNodes.set(NODE_ID_BROADCAST_LR, {} as any)
			;(zwave as any)._nodes.set(NODE_ID_BROADCAST_LR, {} as any)
			const client = await connectedSubscriber('nodes')
			const received = waitForEvent(client, 'NODE_REMOVED')
			;(zwave as any)._refreshBroadcastLRNode()

			expect(NODE_ID_BROADCAST_LR).toBe(4095)
			expect(await received).toEqual({ id: 4095 })
			expect((zwave as any)._virtualNodes.has(NODE_ID_BROADCAST_LR)).toBe(
				false,
			)
		})

		it('NODE_REMOVED: full node object shape via the real _removeNode() (ZwaveClient.ts:8009-8021)', async () => {
			const zwave = realZwave()
			;(zwave as any).storeNodes = {}
			const node = { id: 12, name: 'Removed node', ready: false }
			;(zwave as any)._nodes.set(12, node)
			const client = await connectedSubscriber('nodes')
			const received = waitForEvent(client, 'NODE_REMOVED')
			;(zwave as any)._removeNode(12)

			expect(await received).toEqual(node)
			expect((zwave as any)._nodes.has(12)).toBe(false)
		})

		it('OTW_FIRMWARE_UPDATE: {progress} via the real, throttled _onOTWFirmwareUpdateProgress() (ZwaveClient.ts:6429-6436)', async () => {
			const zwave = realZwave()
			const client = await connectedSubscriber('firmware')
			const received = waitForEvent(client, 'OTW_FIRMWARE_UPDATE')

			// `throttle()` invokes synchronously on its leading edge (the
			// first call for a given key) - no fake timers needed.
			;(zwave as any)._onOTWFirmwareUpdateProgress({
				sentFragments: 3,
				totalFragments: 10,
			})

			expect(await received).toEqual({
				progress: { sentFragments: 3, totalFragments: 10 },
			})
		})

		it('OTW_FIRMWARE_UPDATE: {result:{success,status}} via the real _onOTWFirmwareUpdateFinished() (ZwaveClient.ts:6446-6459)', async () => {
			const zwave = realZwave()
			const client = await connectedSubscriber('firmware')
			const received = waitForEvent(client, 'OTW_FIRMWARE_UPDATE')

			;(zwave as any)._onOTWFirmwareUpdateFinished({
				success: true,
				// `255` is the real zwave-js `OTWFirmwareUpdateStatus.OK`
				// member - the real method runs it through
				// `getEnumMemberName()`, which is why the wire payload
				// below asserts the STRING name, not the raw number.
				status: 255,
			})

			expect(await received).toEqual({
				result: { success: true, status: 'OK' },
			})
		})

		it('NODE_FOUND: {node} via the real _onNodeFound() (ZwaveClient.ts:6674-6690)', async () => {
			const zwave = realZwave()
			zwave.driverReady = true
			;(zwave as any).storeNodes = {}
			;(zwave as any)._driver = {
				controller: {
					getPrioritySUCReturnRouteCached: () => ({}),
					getCustomSUCReturnRoutesCached: () => [],
				},
			}
			const client = await connectedSubscriber('nodes')
			const received = waitForEvent<any>(client, 'NODE_FOUND')
			;(zwave as any)._onNodeFound({ id: 3 })

			const data = await received
			expect(data.node.id).toBe(3)
			expect(data.node.ready).toBe(false)
		})

		it('NODE_ADDED: {node, result} shape (ZwaveClient.ts:6728) - DOCUMENTED BOUNDARY, not reached through its real caller', async () => {
			// `_onNodeAdded()` (the only real producer of this literal)
			// dumps a full `ZWaveNode` via `_dumpNode()`
			// (ZwaveClient.ts:8092+), which reads
			// `zwaveNode.manufacturerId`/`productId`/`deviceConfig`,
			// `driver.configManager.lookupManufacturer(...)`, and
			// security-class/provisioning-entry lookups - reaching it
			// honestly needs a fake `zwave-js` `Driver` + `ZWaveNode`
			// graph broad enough that the fakes themselves would become
			// the thing under test. `sendToSocket` is driven directly
			// here with the exact payload shape copied from the real
			// call site instead, still proving the real literal + routing.
			const zwave = realZwave()
			const client = await connectedSubscriber('nodes')
			const received = waitForEvent(client, 'NODE_ADDED')
			;(zwave as any).sendToSocket('NODE_ADDED', {
				node: { id: 3 },
				result: { success: true },
			})

			expect(await received).toEqual({
				node: { id: 3 },
				result: { success: true },
			})
		})

		it('REBUILD_ROUTES_PROGRESS: array-of-tuples shape (ZwaveClient.ts:5201/5209/6795/5936) - DOCUMENTED BOUNDARY, needs a real zwave-js rebuild-routes controller call', async () => {
			// Every real producer of this literal sits inside a
			// `driver.controller.rebuildNodeRoutes()`/
			// `beginRebuildingRoutes()` progress callback - reaching it
			// honestly needs a real (or heavily faked) zwave-js
			// `Driver`/`Controller`, which this suite deliberately avoids
			// constructing (see the file doc comment). `sendToSocket` is
			// driven directly with the exact payload shape instead.
			const zwave = realZwave()
			const client = await connectedSubscriber('rebuild')
			const received = waitForEvent(client, 'REBUILD_ROUTES_PROGRESS')
			;(zwave as any).sendToSocket('REBUILD_ROUTES_PROGRESS', [
				[2, 'pending'],
			])

			expect(await received).toEqual([[2, 'pending']])
		})

		it('HEALTH_CHECK_PROGRESS: {nodeId, ...} shape (ZwaveClient.ts:6827) - DOCUMENTED BOUNDARY, needs a real zwave-js health-check controller call', async () => {
			// Real producer sits inside a
			// `driver.controller.checkLifelineHealth()`/
			// `checkRouteHealth()` progress callback - same full-driver
			// constraint as REBUILD_ROUTES_PROGRESS above.
			const zwave = realZwave()
			const client = await connectedSubscriber('diagnostics')
			const received = waitForEvent(client, 'HEALTH_CHECK_PROGRESS')
			;(zwave as any).sendToSocket('HEALTH_CHECK_PROGRESS', {
				nodeId: 2,
				rounds: 1,
			})

			expect(await received).toEqual({ nodeId: 2, rounds: 1 })
		})

		it('LINK_RELIABILITY: {nodeId, ...} shape (ZwaveClient.ts:6842) - DOCUMENTED BOUNDARY, needs a real zwave-js link-reliability controller call', async () => {
			// Same full-driver constraint as the two tests above.
			const zwave = realZwave()
			const client = await connectedSubscriber('diagnostics')
			const received = waitForEvent(client, 'LINK_RELIABILITY')
			;(zwave as any).sendToSocket('LINK_RELIABILITY', {
				nodeId: 2,
				rssi: -70,
			})

			expect(await received).toEqual({ nodeId: 2, rssi: -70 })
		})

		it('GRANT_SECURITY_CLASSES/VALIDATE_DSK/INCLUSION_ABORTED: via the real _onGrantSecurityClasses()/_onValidateDSK()/_onAbortInclusion() handlers (ZwaveClient.ts:6852-6913)', async () => {
			const zwave = realZwave()
			const client = await connectedSubscriber('nodes')
			const grantReceived = waitForEvent(client, 'GRANT_SECURITY_CLASSES')
			const dskReceived = waitForEvent(client, 'VALIDATE_DSK')
			const abortReceived = waitForEvent(client, 'INCLUSION_ABORTED')

			// These 3 real handlers have zero driver/node dependencies -
			// callable directly exactly as zwave-js's own driver would
			// invoke them on the matching controller events.
			;(zwave as any)._onGrantSecurityClasses({ securityClasses: [0] })
			;(zwave as any)._onValidateDSK('abc')
			;(zwave as any)._onAbortInclusion()

			expect(await grantReceived).toEqual({ securityClasses: [0] })
			expect(await dskReceived).toBe('abc')
			expect(await abortReceived).toBe(true)
		})

		it('NODE_EVENT: {nodeId, ...} via the real _onNodeEvent() handler (ZwaveClient.ts:7159-7176)', async () => {
			const zwave = realZwave()
			const node: any = { id: 2, eventsQueue: [] }
			;(zwave as any)._nodes.set(2, node)
			const client = await connectedSubscriber('nodes')
			const received = waitForEvent<any>(client, 'NODE_EVENT')
			;(zwave as any)._onNodeEvent('wake up', { id: 2 } as any)

			const data = await received
			expect(data.nodeId).toBe(2)
			expect(data.event.event).toBe('wake up')
			// The real `time: new Date()` field survives Socket.IO's
			// JSON-based wire serialization as an ISO string, not a `Date`
			// instance - assert it round-trips to a valid date instead.
			expect(new Date(data.event.time).toString()).not.toBe(
				'Invalid Date',
			)
			// The real handler also appended the SAME event object onto
			// the node's own `eventsQueue` - proving this ran the REAL
			// handler logic, not a hand-copied literal (the `time` field
			// is compared separately above since it round-trips through
			// wire serialization as a string, unlike the original
			// server-side `Date` object still sitting in `eventsQueue`).
			expect(node.eventsQueue).toEqual([
				{ time: expect.any(Date), event: 'wake up', args: [] },
			])
		})

		it('METADATA_UPDATED: value-metadata shape routed to "values" (ZwaveClient.ts:7693) - DOCUMENTED BOUNDARY, needs a real zwave-js value-metadata-updated node event', async () => {
			// Real producer sits inside `_parseValue()`
			// (ZwaveClient.ts:8509+), which reads
			// `zwaveNode.getValue()`/`getDefinedValueIDs()` off a real
			// `zwave-js` `ZWaveNode` - same full-driver constraint as the
			// other DOCUMENTED BOUNDARY cases above.
			const zwave = realZwave()
			const client = await connectedSubscriber('values')
			const received = waitForEvent(client, 'METADATA_UPDATED')
			;(zwave as any).sendToSocket('METADATA_UPDATED', {
				nodeId: 2,
				commandClass: 37,
				metadata: { readable: true },
			})

			expect(await received).toEqual({
				nodeId: 2,
				commandClass: 37,
				metadata: { readable: true },
			})
		})

		it('VALUE_REMOVED: value-id shape routed to "values" (ZwaveClient.ts:8664) - DOCUMENTED BOUNDARY, needs a real zwave-js "value removed" node event', async () => {
			// Same full-driver constraint as METADATA_UPDATED above - the
			// real producer is a `zwaveNode.on('value removed', ...)`
			// callback fed a real zwave-js `ValueID`.
			const zwave = realZwave()
			const client = await connectedSubscriber('values')
			const received = waitForEvent(client, 'VALUE_REMOVED')
			;(zwave as any).sendToSocket('VALUE_REMOVED', {
				nodeId: 2,
				commandClass: 37,
				property: 'targetValue',
			})

			expect(await received).toEqual({
				nodeId: 2,
				commandClass: 37,
				property: 'targetValue',
			})
		})
	})

	describe('non-sendToSocket producers (bypass channel routing/nextTick entirely)', () => {
		it('DEBUG: the real log interceptor (app.ts setupInterceptor) forwards logStream data to the "debug" room synchronously', async () => {
			const { logStream } = await import('../../../api/lib/logger.ts')
			const client = harness.createClient()
			await harness.connectClient(client)
			await subscribe(client, ['debug'])

			const received = waitForEvent(client, 'DEBUG')
			logStream.write('a debug log line\n')

			expect(await received).toBe('a debug log line\n')
		})

		describe('API_RETURN: documented boundary - its only real producer is unreachable in an automated test (ZwaveClient.ts:8879-8931)', () => {
			// `API_RETURN` is genuinely different from every other event in
			// this file: its ONE real producer call site
			// (`this.socket.emit(socketEvents.api, result)`) lives inside
			// `emulateFwUpdate()`, a `private`, explicitly-labeled "Used
			// for testing purposes" helper that (a) is never called from
			// anywhere else in the backend source (confirmed below - it's
			// dead code, not a reachable production path), (b) is not in
			// `allowedApis` (so it can't be reached through `callApi()`
			// either), and (c) uses `Math.random()` + `setInterval` even
			// if it WERE called. Per this suite's mandate ("test/document
			// the reachable boundary, never fabricate a direct
			// socket.emit"), this is characterized via real-source
			// verification instead of a fabricated `.socket.emit(...)`
			// call standing in for a producer that cannot actually run.
			const zwaveClientSource = readFileSync(
				path.join(repoRoot, 'api/lib/ZwaveClient.ts'),
				'utf8',
			)

			it('has exactly one real producer call site, and it is inside emulateFwUpdate()', () => {
				const producerCalls = (
					zwaveClientSource.match(
						/this\.socket\.emit\(socketEvents\.api,/g,
					) || []
				).length
				expect(producerCalls).toBe(1)
				expect(zwaveClientSource).toContain('private emulateFwUpdate(')
				expect(zwaveClientSource).toContain(
					'/** Used for testing purposes */',
				)
			})

			it('emulateFwUpdate() itself is never called anywhere in ZwaveClient.ts - dead code, not a reachable production path', () => {
				// Any real call would have to be `this.emulateFwUpdate(`
				// (private method, same-class only) - excluded is its own
				// `private emulateFwUpdate(` declaration.
				const callSites = (
					zwaveClientSource.match(
						/(?<!private )\bemulateFwUpdate\(/g,
					) || []
				).length
				expect(callSites).toBe(0)
			})

			it('is not in allowedApis, so it is unreachable through callApi() too', async () => {
				const { allowedApis } = await import(
					'../../../api/lib/ZwaveClient.ts'
				)
				expect(allowedApis).not.toContain('emulateFwUpdate')
			})

			it('is declared with no channel mapping (would bypass room routing entirely, like INIT below, if it were ever reachable)', () => {
				expect(eventToChannel.API_RETURN).toBeUndefined()
			})
		})

		it('INIT: sendInitToSockets() force-emits the current state to every connected socket (ZwaveClient.ts:2676-2683), bypassing channel routing', async () => {
			const zwave = realZwave()
			const client = harness.createClient()
			await harness.connectClient(client)
			const received = waitForEvent<any>(client, 'INIT')

			expect(eventToChannel.INIT).toBeUndefined()
			await (zwave as any).sendInitToSockets()

			const data = await received
			// `getState()`'s `info.uptime` ticks between the real send and
			// this assertion, and several fields default to `undefined`
			// (stripped over the wire) - assert the stable parts instead of
			// a fresh `zwave.getState()` snapshot.
			expect(data.nodes).toEqual([])
			expect(data.info).toMatchObject({
				status: 'closed',
				appVersion: expect.any(String),
				zwaveVersion: expect.any(String),
				serverVersion: expect.any(String),
				uptime: expect.any(Number),
			})
		})

		it('ZNIFFER_STATE: ZnifferManager emits synchronously (no process.nextTick), directly to the "znifferState" room (ZnifferManager.ts:179-182)', async () => {
			const zniffer = new ZnifferManager(
				{ enabled: false } as any,
				harness.io,
			)
			const client = await connectedSubscriber('znifferState')
			const received = waitForEvent(client, 'ZNIFFER_STATE')

			const toSpy = vi.spyOn(harness.io, 'to')
			;(zniffer as any).onStateChange()

			// Unlike ZwaveClient.sendToSocket (which defers via
			// process.nextTick, see above), this call site routes
			// immediately, synchronously, from within `onStateChange()`
			// itself - `io.to(...)` is already called before this line
			// runs.
			expect(toSpy).toHaveBeenCalledWith('znifferState')
			toSpy.mockRestore()

			expect(await received).toEqual(zniffer.status())
		})

		describe('ZNIFFER_FRAME: real producer, driven through the real internal Zniffer instance (ZnifferManager.ts:106-125)', () => {
			// `Zniffer` (from the `zwave-js` package) extends
			// `TypedEventTarget` (`@zwave-js/shared`) - a real, synchronous
			// event target, NOT a mock. Its constructor only validates
			// `port`'s type; no real serial I/O happens until `.init()` is
			// called. `ZnifferManager`'s own constructor registers the
			// REAL `'frame'`/`'corrupted frame'` listeners under test here
			// synchronously, then fire-and-forgets `this.init()` (which
			// would open a real serial port). Only `Zniffer.prototype.init`
			// is stubbed (never real `ZnifferManager` logic) so this test
			// drives the real listener with a real `.emit(...)` call
			// instead of asserting against `io.to(...).emit(...)` directly
			// like a mock would.
			let initSpy: ReturnType<typeof vi.spyOn>
			let destroySpy: ReturnType<typeof vi.spyOn>

			beforeEach(() => {
				initSpy = vi
					.spyOn(Zniffer.prototype, 'init')
					.mockResolvedValue(undefined as any)
				// Real `.destroy()` tears down internal loggers that are
				// only ever set up by a real (non-stubbed) `.init()` - it
				// isn't the thing under test here, so it's stubbed too,
				// purely to make `ZnifferManager.close()` a safe, no-crash
				// cleanup step in `finally` below.
				destroySpy = vi
					.spyOn(Zniffer.prototype, 'destroy')
					.mockResolvedValue(undefined as any)
			})

			afterEach(() => {
				initSpy.mockRestore()
				destroySpy.mockRestore()
			})

			it('a real "frame" event -> parseFrame() -> ZNIFFER_FRAME on "znifferFrames", uncorrupted (has `protocol`)', async () => {
				const znifferManager = new ZnifferManager(
					{ enabled: true, port: '/dev/ttyFAKE' } as any,
					harness.io,
				)
				try {
					const client = await connectedSubscriber('znifferFrames')
					const received = waitForEvent<any>(client, 'ZNIFFER_FRAME')

					const rawData = Uint8Array.from([0xaa, 0xbb, 0xcc])
					// A non-corrupted `Frame` only needs a `protocol` key
					// for `parseFrame()`'s `!('protocol' in frame)` check;
					// omitting `payload` keeps `buffer2hex()` out of the
					// picture for this variant (asserted separately below).
					const frame = { protocol: 'Z-Wave' } as any
					;(znifferManager as any).zniffer.emit(
						'frame',
						frame,
						rawData,
					)

					const data = await received
					expect(data.corrupted).toBe(false)
					expect(data.protocol).toBe('Z-Wave')
					expect(data.raw).toBe(buffer2hex(rawData))
				} finally {
					await znifferManager.close()
				}
			})

			it('a real "corrupted frame" event -> parseFrame() -> ZNIFFER_FRAME, marked corrupted (no `protocol`)', async () => {
				const znifferManager = new ZnifferManager(
					{ enabled: true, port: '/dev/ttyFAKE' } as any,
					harness.io,
				)
				try {
					const client = await connectedSubscriber('znifferFrames')
					const received = waitForEvent<any>(client, 'ZNIFFER_FRAME')

					const rawData = Uint8Array.from([0x01])
					// A corrupted frame has no `protocol` key at all.
					const frame = { reason: 'bad checksum' } as any
					;(znifferManager as any).zniffer.emit(
						'corrupted frame',
						frame,
						rawData,
					)

					const data = await received
					expect(data.corrupted).toBe(true)
					expect(data.raw).toBe(buffer2hex(rawData))
				} finally {
					await znifferManager.close()
				}
			})
		})
	})
})
