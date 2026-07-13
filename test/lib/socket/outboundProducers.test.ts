/**
 * Characterizes every one of the 24 outbound producer call sites in `ZwaveClient.ts`/`ZnifferManager.ts`/`app.ts`: literal event name, payload shape, argument order, channel routing, and `process.nextTick` deferral where the real code defers.
 *
 * `ZwaveClient.sendToSocket` is the shared routing point for ~21 of the 24 events, looking up `eventToChannel[evtName]` to room-route or falling back to an unrouted broadcast - a real `ZWaveClient` drives this against the harness's real `io`, not a mock.
 */
import {
	describe,
	it,
	expect,
	beforeAll,
	beforeEach,
	afterEach,
	vi,
} from 'vitest'
import { NODE_ID_BROADCAST_LR } from '@zwave-js/core'
import { Zniffer } from 'zwave-js'
import type ZWaveClientType from '#api/lib/ZwaveClient.ts'
import type ZnifferManagerType from '#api/lib/ZnifferManager.ts'
import { eventToChannel } from '#api/lib/SocketEvents.ts'
import { buffer2hex } from '#api/lib/utils.ts'
import { useSocketHarness, type SocketHarness } from './harness.ts'
import { createFakeGateway } from './fakes.ts'

describe('Socket contract: outbound producers', () => {
	const getHarness = useSocketHarness()
	let ZWaveClient: typeof ZWaveClientType
	let ZnifferManager: typeof ZnifferManagerType

	beforeAll(async () => {
		// Runs after useSocketHarness()'s own beforeAll (registered first, so FIFO order isolates STORE_DIR first) since real ZwaveClient.ts/ZnifferManager.ts bind their jsonStore at module-evaluation time
		;({ default: ZWaveClient } = await import('#api/lib/ZwaveClient.ts'))
		;({ default: ZnifferManager } = await import(
			'#api/lib/ZnifferManager.ts'
		))
	})

	// Every test needs at least a bare gateway stub since connecting a client triggers the real 'clients' callback, which reads gw.zwave?.setUserCallbacks() and throws if gw itself is undefined
	function benignGateway() {
		return createFakeGateway({ zwave: undefined })
	}

	// Wires the real ZWaveClient to the harness's real Socket.IO server
	// Safe to construct directly since the constructor only touches jsonStore, never a real driver or serial port, unless connect() is called
	function realZwave(harness: SocketHarness): ZWaveClientType {
		return new ZWaveClient({} as any, harness.io)
	}

	// Subscribes client to channel and resolves once the ack lands
	function subscribe(client: any, channels: string[]): Promise<any> {
		return new Promise((resolve) => {
			client.emit('SUBSCRIBE', { channels }, resolve)
		})
	}

	async function connectedSubscriber(
		harness: SocketHarness,
		channel: string,
	) {
		const client = harness.createClient()
		await harness.connectClient(client)
		await subscribe(client, [channel])
		return client
	}

	// Resolves with the payload the next time event is received on client, so delivery assertions are event-driven instead of timer-based
	function waitForEvent<T = unknown>(client: any, event: string): Promise<T> {
		return new Promise((resolve) => client.once(event, resolve))
	}

	// Like waitForEvent, but captures every argument for events that pass more than one, e.g. NODE_UPDATED's (node, isPartial)
	function waitForArgs(client: any, event: string): Promise<unknown[]> {
		return new Promise((resolve) =>
			client.once(event, (...args: unknown[]) => resolve(args)),
		)
	}

	describe('sendToSocket mechanics (shared by ~21 of the 24 events)', () => {
		it('routes to eventToChannel[event] and defers the actual emit via process.nextTick', async () => {
			const harness = await getHarness({ gateway: benignGateway() })
			const zwave = realZwave(harness)
			const client = await connectedSubscriber(harness, 'nodes')
			const received = waitForEvent(client, 'NODE_ADDED')

			// Spies on the real io.to() call to prove the nextTick deferral directly in-process, rather than inferring it from wire-delivery timing
			const toSpy = vi.spyOn(harness.io, 'to')
			;(zwave as any).sendToSocket('NODE_ADDED', { node: { id: 9 } })
			expect(toSpy).not.toHaveBeenCalled()

			await new Promise<void>((resolve) => process.nextTick(resolve))
			expect(toSpy).toHaveBeenCalledWith('nodes')
			toSpy.mockRestore()

			expect(eventToChannel.NODE_ADDED).toBe('nodes')
			expect(await received).toEqual({ node: { id: 9 } })
		})

		it('falls back to an unrouted broadcast for an event with no channel mapping', async () => {
			const harness = await getHarness({ gateway: benignGateway() })
			const zwave = realZwave(harness)
			const client = harness.createClient()
			await harness.connectClient(client)
			// Not subscribed to any channel, since the broadcast fallback must still reach it unlike the routed case above
			const received = waitForEvent(client, 'SOME_UNMAPPED_EVENT')

			expect(eventToChannel.SOME_UNMAPPED_EVENT).toBeUndefined()
			;(zwave as any).sendToSocket('SOME_UNMAPPED_EVENT', {
				hello: 'world',
			})

			expect(await received).toEqual({ hello: 'world' })
		})

		it('passes every extra argument through, in order, after the payload', async () => {
			const harness = await getHarness({ gateway: benignGateway() })
			const zwave = realZwave(harness)
			const client = await connectedSubscriber(harness, 'nodes')
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
			const harness = await getHarness({ gateway: benignGateway() })
			const zwave = realZwave(harness)
			;(zwave as any)._driver = {
				controller: { nodes: { get: () => undefined } },
			}
			const client = await connectedSubscriber(harness, 'values')
			const received = waitForEvent<any>(client, 'VALUE_UPDATED')

			const valueId: any = { nodeId: 2, commandClass: 37, property: 'x' }
			zwave.emitValueChanged(valueId, { id: 2 } as any, true)

			const data = await received
			expect(data.nodeId).toBe(2)
			expect(data.lastUpdate).toEqual(expect.any(Number))
		})

		it('emitValueChanged() sends nothing when changed=false', async () => {
			const harness = await getHarness({ gateway: benignGateway() })
			const zwave = realZwave(harness)
			;(zwave as any)._driver = {
				controller: { nodes: { get: () => undefined } },
			}
			const client = await connectedSubscriber(harness, 'values')
			const box: unknown[] = []
			client.on('VALUE_UPDATED', (data: unknown) => box.push(data))

			zwave.emitValueChanged(
				{ nodeId: 2, commandClass: 37, property: 'x' } as any,
				{ id: 2 } as any,
				false,
			)

			// Fires a second, distinct, definitely-emitting call on the same channel and awaits that instead of a fixed sleep: FIFO per-connection delivery means an incorrect emit above would already have arrived
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
			const harness = await getHarness({ gateway: benignGateway() })
			const zwave = realZwave(harness)
			const client = await connectedSubscriber(harness, 'statistics')
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
			const harness = await getHarness({ gateway: benignGateway() })
			const zwave = realZwave(harness)
			const client = await connectedSubscriber(harness, 'nodes')
			const received = waitForArgs(client, 'NODE_UPDATED')

			const node = { id: 7, ready: true } as any
			zwave.emitNodeUpdate(node)

			expect(await received).toEqual([node, false])
		})

		it('emitNodeUpdate() sends only changedProps (+id) with isPartial=true for a partial update', async () => {
			const harness = await getHarness({ gateway: benignGateway() })
			const zwave = realZwave(harness)
			const client = await connectedSubscriber(harness, 'nodes')
			const received = waitForArgs(client, 'NODE_UPDATED')

			const node = { id: 7, ready: true } as any
			zwave.emitNodeUpdate(node, { status: 'alive' } as any)

			expect(await received).toEqual([{ status: 'alive', id: 7 }, true])
		})

		it('_updateControllerStatus() sends CONTROLLER_CMD with status (error/inclusionState default to undefined, stripped over the wire) (ZwaveClient.ts:6589-6598)', async () => {
			const harness = await getHarness({ gateway: benignGateway() })
			const zwave = realZwave(harness)
			const client = await connectedSubscriber(harness, 'controller')
			const received = waitForEvent(client, 'CONTROLLER_CMD')
			;(zwave as any)._updateControllerStatus('Removing failed node')

			// error/inclusionState default to undefined on a fresh client, and undefined-valued keys are stripped by JSON serialization, so only status survives the wire
			expect(await received).toEqual({ status: 'Removing failed node' })
		})

		it('_updateControllerStatus() is a no-op (no emit) when the status has not actually changed', async () => {
			const harness = await getHarness({ gateway: benignGateway() })
			const zwave = realZwave(harness)
			const client = await connectedSubscriber(harness, 'controller')
			const box: unknown[] = []
			client.on('CONTROLLER_CMD', (data: unknown) => box.push(data))

			const first = waitForEvent(client, 'CONTROLLER_CMD')
			;(zwave as any)._updateControllerStatus('Idle')
			await first

			// Repeats the same status (expected no-op), then fires a different status and awaits that instead of a fixed sleep, since FIFO delivery means the repeat's absent emit would have arrived first
			const marker = waitForEvent(client, 'CONTROLLER_CMD')
			;(zwave as any)._updateControllerStatus('Idle')
			;(zwave as any)._updateControllerStatus('Removing failed node')
			await marker

			expect(box).toHaveLength(2)
			expect((box[0] as any).status).toBe('Idle')
			expect((box[1] as any).status).toBe('Removing failed node')
		})

		it("checkForConfigUpdates() sends INFO with getInfo()'s real payload (ZwaveClient.ts:4442-4448)", async () => {
			const harness = await getHarness({ gateway: benignGateway() })
			const zwave = realZwave(harness)
			;(zwave as any)._driver = {
				checkForConfigUpdates: vi.fn(() => Promise.resolve('1.2.3')),
			}
			zwave.driverReady = true
			const client = await connectedSubscriber(harness, 'controller')
			const received = waitForEvent<any>(client, 'INFO')

			const newVersion = await zwave.checkForConfigUpdates()

			expect(newVersion).toBe('1.2.3')
			const data = await received
			expect(data.appVersion).toEqual(expect.any(String))
			expect(data.zwaveVersion).toEqual(expect.any(String))
		})

		it("_deleteGroup() sends NODE_REMOVED with just {id} (ZwaveClient.ts:3225) - one of NODE_REMOVED's 3 real shapes", async () => {
			const harness = await getHarness({ gateway: benignGateway() })
			const zwave = realZwave(harness)
			zwave.groups = [{ id: 42, name: 'Test group' } as any]
			const client = await connectedSubscriber(harness, 'nodes')
			const received = waitForEvent(client, 'NODE_REMOVED')

			const deleted = await zwave._deleteGroup(42)

			expect(deleted).toBe(true)
			expect(await received).toEqual({ id: 42 })
		})
	})

	describe('additional real literals/shapes: driven through their real producing method/handler', () => {
		it('NODE_REMOVED: {id: NODE_ID_BROADCAST_LR} via the real _refreshBroadcastLRNode() deletion branch (ZwaveClient.ts:4088-4096)', async () => {
			const harness = await getHarness({ gateway: benignGateway() })
			const zwave = realZwave(harness)
			zwave.driverReady = true
			;(zwave as any)._driver = {
				controller: { supportsLongRange: false, nodes: new Map() },
			}
			// Pre-populates as if the LR broadcast virtual node already existed, so the real method's deletion branch fires since hasLRNodes is false
			;(zwave as any)._virtualNodes.set(NODE_ID_BROADCAST_LR, {} as any)
			;(zwave as any)._nodes.set(NODE_ID_BROADCAST_LR, {} as any)
			const client = await connectedSubscriber(harness, 'nodes')
			const received = waitForEvent(client, 'NODE_REMOVED')
			;(zwave as any)._refreshBroadcastLRNode()

			expect(NODE_ID_BROADCAST_LR).toBe(4095)
			expect(await received).toEqual({ id: 4095 })
			expect((zwave as any)._virtualNodes.has(NODE_ID_BROADCAST_LR)).toBe(
				false,
			)
		})

		it('NODE_REMOVED: full node object shape via the real _removeNode() (ZwaveClient.ts:8009-8021)', async () => {
			const harness = await getHarness({ gateway: benignGateway() })
			const zwave = realZwave(harness)
			;(zwave as any).storeNodes = {}
			const node = { id: 12, name: 'Removed node', ready: false }
			;(zwave as any)._nodes.set(12, node)
			const client = await connectedSubscriber(harness, 'nodes')
			const received = waitForEvent(client, 'NODE_REMOVED')
			;(zwave as any)._removeNode(12)

			expect(await received).toEqual(node)
			expect((zwave as any)._nodes.has(12)).toBe(false)
		})

		it('OTW_FIRMWARE_UPDATE: {progress} via the real, throttled _onOTWFirmwareUpdateProgress() (ZwaveClient.ts:6429-6436)', async () => {
			const harness = await getHarness({ gateway: benignGateway() })
			const zwave = realZwave(harness)
			const client = await connectedSubscriber(harness, 'firmware')
			const received = waitForEvent(client, 'OTW_FIRMWARE_UPDATE')

			// throttle() invokes synchronously on its leading edge, so no fake timers are needed
			;(zwave as any)._onOTWFirmwareUpdateProgress({
				sentFragments: 3,
				totalFragments: 10,
			})

			expect(await received).toEqual({
				progress: { sentFragments: 3, totalFragments: 10 },
			})
		})

		it('OTW_FIRMWARE_UPDATE: {result:{success,status}} via the real _onOTWFirmwareUpdateFinished() (ZwaveClient.ts:6446-6459)', async () => {
			const harness = await getHarness({ gateway: benignGateway() })
			const zwave = realZwave(harness)
			const client = await connectedSubscriber(harness, 'firmware')
			const received = waitForEvent(client, 'OTW_FIRMWARE_UPDATE')

			;(zwave as any)._onOTWFirmwareUpdateFinished({
				success: true,
				// 255 is zwave-js's real OTWFirmwareUpdateStatus.OK member, run through getEnumMemberName() so the wire payload asserts the string name
				status: 255,
			})

			expect(await received).toEqual({
				result: { success: true, status: 'OK' },
			})
		})

		it('NODE_FOUND: {node} via the real _onNodeFound() (ZwaveClient.ts:6674-6690)', async () => {
			const harness = await getHarness({ gateway: benignGateway() })
			const zwave = realZwave(harness)
			zwave.driverReady = true
			;(zwave as any).storeNodes = {}
			;(zwave as any)._driver = {
				controller: {
					getPrioritySUCReturnRouteCached: () => ({}),
					getCustomSUCReturnRoutesCached: () => [],
				},
			}
			const client = await connectedSubscriber(harness, 'nodes')
			const received = waitForEvent<any>(client, 'NODE_FOUND')
			;(zwave as any)._onNodeFound({ id: 3 })

			const data = await received
			expect(data.node.id).toBe(3)
			expect(data.node.ready).toBe(false)
		})

		it('NODE_ADDED: {node, result} shape (ZwaveClient.ts:6728) - DOCUMENTED BOUNDARY, not reached through its real caller', async () => {
			// _onNodeAdded() dumps a full ZWaveNode via _dumpNode(), which needs a driver/node graph too broad to fake honestly, so this drives sendToSocket directly with the real call site's payload shape
			const harness = await getHarness({ gateway: benignGateway() })
			const zwave = realZwave(harness)
			const client = await connectedSubscriber(harness, 'nodes')
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
			// Every real producer sits inside a rebuildNodeRoutes()/beginRebuildingRoutes() controller callback that needs a full zwave-js Driver/Controller to reach, so sendToSocket is driven directly with the real payload shape instead
			const harness = await getHarness({ gateway: benignGateway() })
			const zwave = realZwave(harness)
			const client = await connectedSubscriber(harness, 'rebuild')
			const received = waitForEvent(client, 'REBUILD_ROUTES_PROGRESS')
			;(zwave as any).sendToSocket('REBUILD_ROUTES_PROGRESS', [
				[2, 'pending'],
			])

			expect(await received).toEqual([[2, 'pending']])
		})

		it('HEALTH_CHECK_PROGRESS: {nodeId, ...} shape (ZwaveClient.ts:6827) - DOCUMENTED BOUNDARY, needs a real zwave-js health-check controller call', async () => {
			// Same full-driver constraint as REBUILD_ROUTES_PROGRESS above: the real producer sits inside a checkLifelineHealth()/checkRouteHealth() controller callback
			const harness = await getHarness({ gateway: benignGateway() })
			const zwave = realZwave(harness)
			const client = await connectedSubscriber(harness, 'diagnostics')
			const received = waitForEvent(client, 'HEALTH_CHECK_PROGRESS')
			;(zwave as any).sendToSocket('HEALTH_CHECK_PROGRESS', {
				nodeId: 2,
				rounds: 1,
			})

			expect(await received).toEqual({ nodeId: 2, rounds: 1 })
		})

		it('LINK_RELIABILITY: {nodeId, ...} shape (ZwaveClient.ts:6842) - DOCUMENTED BOUNDARY, needs a real zwave-js link-reliability controller call', async () => {
			// Same full-driver constraint as the two tests above
			const harness = await getHarness({ gateway: benignGateway() })
			const zwave = realZwave(harness)
			const client = await connectedSubscriber(harness, 'diagnostics')
			const received = waitForEvent(client, 'LINK_RELIABILITY')
			;(zwave as any).sendToSocket('LINK_RELIABILITY', {
				nodeId: 2,
				rssi: -70,
			})

			expect(await received).toEqual({ nodeId: 2, rssi: -70 })
		})

		it('GRANT_SECURITY_CLASSES/VALIDATE_DSK/INCLUSION_ABORTED: via the real _onGrantSecurityClasses()/_onValidateDSK()/_onAbortInclusion() handlers (ZwaveClient.ts:6852-6913)', async () => {
			const harness = await getHarness({ gateway: benignGateway() })
			const zwave = realZwave(harness)
			const client = await connectedSubscriber(harness, 'nodes')
			const grantReceived = waitForEvent(client, 'GRANT_SECURITY_CLASSES')
			const dskReceived = waitForEvent(client, 'VALIDATE_DSK')
			const abortReceived = waitForEvent(client, 'INCLUSION_ABORTED')

			// These 3 real handlers have zero driver/node dependencies, callable directly the same way zwave-js's own driver would invoke them
			;(zwave as any)._onGrantSecurityClasses({ securityClasses: [0] })
			;(zwave as any)._onValidateDSK('abc')
			;(zwave as any)._onAbortInclusion()

			expect(await grantReceived).toEqual({ securityClasses: [0] })
			expect(await dskReceived).toBe('abc')
			expect(await abortReceived).toBe(true)
		})

		it('NODE_EVENT: {nodeId, ...} via the real _onNodeEvent() handler (ZwaveClient.ts:7159-7176)', async () => {
			const harness = await getHarness({ gateway: benignGateway() })
			const zwave = realZwave(harness)
			const node: any = { id: 2, eventsQueue: [] }
			;(zwave as any)._nodes.set(2, node)
			const client = await connectedSubscriber(harness, 'nodes')
			const received = waitForEvent<any>(client, 'NODE_EVENT')
			;(zwave as any)._onNodeEvent('wake up', { id: 2 } as any)

			const data = await received
			expect(data.nodeId).toBe(2)
			expect(data.event.event).toBe('wake up')
			// Survives Socket.IO's JSON wire serialization as an ISO string rather than a Date instance, so assert it round-trips to a valid date instead
			expect(new Date(data.event.time).toString()).not.toBe(
				'Invalid Date',
			)
			// Proves this ran the real handler logic, not a hand-copied literal, by checking the same event object was appended to the node's own eventsQueue
			expect(node.eventsQueue).toEqual([
				{ time: expect.any(Date), event: 'wake up', args: [] },
			])
		})

		it('METADATA_UPDATED: value-metadata shape routed to "values" (ZwaveClient.ts:7693) - DOCUMENTED BOUNDARY, needs a real zwave-js value-metadata-updated node event', async () => {
			// Real producer sits inside _parseValue(), which reads zwaveNode.getValue()/getDefinedValueIDs() off a real ZWaveNode, the same full-driver constraint as the other DOCUMENTED BOUNDARY cases above
			const harness = await getHarness({ gateway: benignGateway() })
			const zwave = realZwave(harness)
			const client = await connectedSubscriber(harness, 'values')
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
			// Same full-driver constraint as METADATA_UPDATED above: the real producer is a zwaveNode.on('value removed', ...) callback fed a real zwave-js ValueID
			const harness = await getHarness({ gateway: benignGateway() })
			const zwave = realZwave(harness)
			const client = await connectedSubscriber(harness, 'values')
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
			const harness = await getHarness({
				gateway: benignGateway(),
				interceptor: true,
			})
			const { logStream } = await import('#api/lib/logger.ts')
			const client = harness.createClient()
			await harness.connectClient(client)
			await subscribe(client, ['debug'])

			const received = waitForEvent(client, 'DEBUG')
			logStream.write('a debug log line\n')

			expect(await received).toBe('a debug log line\n')
		})

		describe('API_RETURN: documented boundary - its only real producer is unreachable in an automated test (ZwaveClient.ts:8879-8931)', () => {
			// The only real producer sits inside emulateFwUpdate(), a private "testing purposes" helper that uses Math.random()/setInterval; verified structurally below instead of via a fabricated socket.emit() call
			it('is not in allowedApis, so it is unreachable through callApi() too', async () => {
				const { allowedApis } = await import('#api/lib/ZwaveClient.ts')
				expect(allowedApis).not.toContain('emulateFwUpdate')
			})

			it('is declared with no channel mapping (would bypass room routing entirely, like INIT below, if it were ever reachable)', () => {
				expect(eventToChannel.API_RETURN).toBeUndefined()
			})
		})

		it('INIT: sendInitToSockets() force-emits the current state to every connected socket (ZwaveClient.ts:2676-2683), bypassing channel routing', async () => {
			const harness = await getHarness({ gateway: benignGateway() })
			const zwave = realZwave(harness)
			const client = harness.createClient()
			await harness.connectClient(client)
			const received = waitForEvent<any>(client, 'INIT')

			expect(eventToChannel.INIT).toBeUndefined()
			await (zwave as any).sendInitToSockets()

			const data = await received
			// info.uptime ticks between the real send and this assertion, and several fields default to undefined and are stripped over the wire, so assert the stable parts instead of a fresh snapshot
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
			const harness = await getHarness({ gateway: benignGateway() })
			const zniffer = new ZnifferManager(
				{ enabled: false } as any,
				harness.io,
			)
			const client = await connectedSubscriber(harness, 'znifferState')
			const received = waitForEvent(client, 'ZNIFFER_STATE')

			const toSpy = vi.spyOn(harness.io, 'to')
			;(zniffer as any).onStateChange()

			// Unlike ZwaveClient.sendToSocket, which defers via process.nextTick, this call site routes immediately and synchronously from within onStateChange() itself
			expect(toSpy).toHaveBeenCalledWith('znifferState')
			toSpy.mockRestore()

			expect(await received).toEqual(zniffer.status())
		})

		describe('ZNIFFER_FRAME: real producer, driven through the real internal Zniffer instance (ZnifferManager.ts:106-125)', () => {
			// Zniffer's constructor only validates port's type and does no real serial I/O until .init() is called, so only Zniffer.prototype.init is stubbed while ZnifferManager's real 'frame'/'corrupted frame' listeners stay live for this test to drive with a real .emit() call
			let initSpy: ReturnType<typeof vi.spyOn>
			let destroySpy: ReturnType<typeof vi.spyOn>

			beforeEach(() => {
				initSpy = vi
					.spyOn(Zniffer.prototype, 'init')
					.mockResolvedValue(undefined as any)
				// Real .destroy() tears down internal loggers only set up by a real .init(), so it's stubbed too purely to keep ZnifferManager.close() a safe no-crash cleanup step
				destroySpy = vi
					.spyOn(Zniffer.prototype, 'destroy')
					.mockResolvedValue(undefined as any)
			})

			afterEach(() => {
				initSpy.mockRestore()
				destroySpy.mockRestore()
			})

			it('a real "frame" event -> parseFrame() -> ZNIFFER_FRAME on "znifferFrames", uncorrupted (has `protocol`)', async () => {
				const harness = await getHarness({ gateway: benignGateway() })
				const znifferManager = new ZnifferManager(
					{ enabled: true, port: '/dev/ttyFAKE' } as any,
					harness.io,
				)
				try {
					const client = await connectedSubscriber(
						harness,
						'znifferFrames',
					)
					const received = waitForEvent<any>(client, 'ZNIFFER_FRAME')

					const rawData = Uint8Array.from([0xaa, 0xbb, 0xcc])
					// A non-corrupted Frame only needs a protocol key for parseFrame()'s check, so omitting payload keeps buffer2hex() out of the picture for this variant
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
				const harness = await getHarness({ gateway: benignGateway() })
				const znifferManager = new ZnifferManager(
					{ enabled: true, port: '/dev/ttyFAKE' } as any,
					harness.io,
				)
				try {
					const client = await connectedSubscriber(
						harness,
						'znifferFrames',
					)
					const received = waitForEvent<any>(client, 'ZNIFFER_FRAME')

					const rawData = Uint8Array.from([0x01])
					// A corrupted frame has no protocol key at all
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
