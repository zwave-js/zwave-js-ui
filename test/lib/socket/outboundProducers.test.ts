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
 * "public contract", see `callApi.test.ts`) method without needing a full
 * driver graph, this file calls that real method so the PAYLOAD itself is
 * exercised too, not just the literal/routing. Where a call site sits deep
 * inside driver-dependent logic (e.g. inclusion, health checks, LR
 * broadcast-node bookkeeping), this file instead drives `sendToSocket`
 * directly with the exact payload shape copied from that call site's
 * source (cited in each test's comment) - still proving the real routing
 * mechanism + the real literal, without fabricating driver state that
 * would make the test more fragile than informative.
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
import { NODE_ID_BROADCAST_LR } from '@zwave-js/core'
import ZWaveClient from '../../../api/lib/ZwaveClient.ts'
import ZnifferManager from '../../../api/lib/ZnifferManager.ts'
import { eventToChannel } from '../../../api/lib/SocketEvents.ts'
import { createSocketHarness, type SocketHarness } from './harness.ts'
import { createFakeGateway } from './fakes.ts'

describe('Socket contract: outbound producers', () => {
	let harness: SocketHarness

	beforeAll(async () => {
		harness = await createSocketHarness()
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
	function realZwave(): ZWaveClient {
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

	/** Waits one macrotask - enough for a `process.nextTick` callback to run. */
	function tick() {
		return new Promise((resolve) => setTimeout(resolve, 20))
	}

	describe('sendToSocket mechanics (shared by ~21 of the 24 events)', () => {
		it('routes to eventToChannel[event] and defers the actual emit via process.nextTick', async () => {
			const zwave = realZwave()
			const client = await connectedSubscriber('nodes')
			const box: unknown[] = []
			client.on('NODE_ADDED', (data: unknown) => box.push(data))

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

			await tick()
			expect(eventToChannel.NODE_ADDED).toBe('nodes')
			expect(box).toEqual([{ node: { id: 9 } }])
		})

		it('falls back to an unrouted broadcast for an event with no channel mapping', async () => {
			const zwave = realZwave()
			const client = harness.createClient()
			await harness.connectClient(client)
			// Deliberately NOT subscribed to any channel - the broadcast
			// fallback (`this.socket.emit(...)`, no room) must still reach
			// it, unlike the routed case above.
			const box: unknown[] = []
			client.on('SOME_UNMAPPED_EVENT', (data: unknown) => box.push(data))

			expect(eventToChannel.SOME_UNMAPPED_EVENT).toBeUndefined()
			;(zwave as any).sendToSocket('SOME_UNMAPPED_EVENT', {
				hello: 'world',
			})
			await tick()

			expect(box).toEqual([{ hello: 'world' }])
		})

		it('passes every extra argument through, in order, after the payload', async () => {
			const zwave = realZwave()
			const client = await connectedSubscriber('nodes')
			const received: unknown[] = []
			client.on('NODE_UPDATED', (...args: unknown[]) =>
				received.push(args),
			)
			;(zwave as any).sendToSocket(
				'NODE_UPDATED',
				{ id: 2 },
				true,
				'extra-arg',
			)
			await tick()

			expect(received).toEqual([[{ id: 2 }, true, 'extra-arg']])
		})
	})

	describe('real producer methods', () => {
		it('emitValueChanged() sends VALUE_UPDATED with the mutated valueId when changed=true (ZwaveClient.ts:2699)', async () => {
			const zwave = realZwave()
			;(zwave as any)._driver = {
				controller: { nodes: { get: () => undefined } },
			}
			const client = await connectedSubscriber('values')
			const box: unknown[] = []
			client.on('VALUE_UPDATED', (data: unknown) => box.push(data))

			const valueId: any = { nodeId: 2, commandClass: 37, property: 'x' }
			zwave.emitValueChanged(valueId, { id: 2 } as any, true)
			await tick()

			expect(box).toHaveLength(1)
			expect((box[0] as any).nodeId).toBe(2)
			expect((box[0] as any).lastUpdate).toEqual(expect.any(Number))
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
			await tick()

			expect(box).toEqual([])
		})

		it('emitStatistics() converts every null prop to false, leaves others untouched (ZwaveClient.ts:2708-2731)', async () => {
			const zwave = realZwave()
			const client = await connectedSubscriber('statistics')
			const box: unknown[] = []
			client.on('STATISTICS', (data: unknown) => box.push(data))

			zwave.emitStatistics(
				{ id: 5 } as any,
				{
					statistics: null,
					lastActive: null,
					applicationRoute: { hops: [] } as any,
				} as any,
			)
			await tick()

			expect(box).toEqual([
				{
					nodeId: 5,
					statistics: false,
					lastActive: false,
					applicationRoute: { hops: [] },
				},
			])
		})

		it('emitNodeUpdate() sends the FULL node with isPartial=false when no changedProps are given (ZwaveClient.ts:2733-2756)', async () => {
			const zwave = realZwave()
			const client = await connectedSubscriber('nodes')
			const received: unknown[] = []
			client.on('NODE_UPDATED', (...args: unknown[]) =>
				received.push(args),
			)

			const node = { id: 7, ready: true } as any
			zwave.emitNodeUpdate(node)
			await tick()

			expect(received).toEqual([[node, false]])
		})

		it('emitNodeUpdate() sends only changedProps (+id) with isPartial=true for a partial update', async () => {
			const zwave = realZwave()
			const client = await connectedSubscriber('nodes')
			const received: unknown[] = []
			client.on('NODE_UPDATED', (...args: unknown[]) =>
				received.push(args),
			)

			const node = { id: 7, ready: true } as any
			zwave.emitNodeUpdate(node, { status: 'alive' } as any)
			await tick()

			expect(received).toEqual([[{ status: 'alive', id: 7 }, true]])
		})

		it('_updateControllerStatus() sends CONTROLLER_CMD with status (error/inclusionState default to undefined, stripped over the wire) (ZwaveClient.ts:6589-6598)', async () => {
			const zwave = realZwave()
			const client = await connectedSubscriber('controller')
			const box: unknown[] = []
			client.on('CONTROLLER_CMD', (data: unknown) => box.push(data))
			;(zwave as any)._updateControllerStatus('Removing failed node')
			await tick()

			// `error`/`inclusionState` are real fields on the payload
			// object (`this._error`, `this._inclusionState`), but both
			// default to `undefined` on a fresh client - `undefined`-valued
			// object keys are stripped by JSON serialization, so only
			// `status` survives the wire.
			expect(box).toEqual([{ status: 'Removing failed node' }])
		})

		it('_updateControllerStatus() is a no-op (no emit) when the status has not actually changed', async () => {
			const zwave = realZwave()
			const client = await connectedSubscriber('controller')
			const box: unknown[] = []
			client.on('CONTROLLER_CMD', (data: unknown) => box.push(data))
			;(zwave as any)._updateControllerStatus('Idle')
			await tick()
			;(zwave as any)._updateControllerStatus('Idle')
			await tick()

			expect(box).toHaveLength(1)
		})

		it("checkForConfigUpdates() sends INFO with getInfo()'s real payload (ZwaveClient.ts:4442-4448)", async () => {
			const zwave = realZwave()
			;(zwave as any)._driver = {
				checkForConfigUpdates: vi.fn(() => Promise.resolve('1.2.3')),
			}
			zwave.driverReady = true
			const client = await connectedSubscriber('controller')
			const box: unknown[] = []
			client.on('INFO', (data: unknown) => box.push(data))

			const newVersion = await zwave.checkForConfigUpdates()
			await tick()

			expect(newVersion).toBe('1.2.3')
			expect(box).toHaveLength(1)
			expect((box[0] as any).appVersion).toEqual(expect.any(String))
			expect((box[0] as any).zwaveVersion).toEqual(expect.any(String))
		})

		it("_deleteGroup() sends NODE_REMOVED with just {id} (ZwaveClient.ts:3225) - one of NODE_REMOVED's 3 real shapes", async () => {
			const zwave = realZwave()
			zwave.groups = [{ id: 42, name: 'Test group' } as any]
			const client = await connectedSubscriber('nodes')
			const box: unknown[] = []
			client.on('NODE_REMOVED', (data: unknown) => box.push(data))

			const deleted = await zwave._deleteGroup(42)
			await tick()

			expect(deleted).toBe(true)
			expect(box).toEqual([{ id: 42 }])
		})
	})

	describe('additional real literals/shapes exercised directly via sendToSocket', () => {
		// Each of these copies the EXACT payload shape observed at its real
		// call site (cited per test) - driving `sendToSocket` directly
		// because the surrounding method needs a full driver/node graph this
		// suite deliberately avoids constructing (see the file doc comment).

		it('NODE_REMOVED: {id: NODE_ID_BROADCAST_LR} shape from _refreshBroadcastLRNode (ZwaveClient.ts:4095)', async () => {
			const zwave = realZwave()
			const client = await connectedSubscriber('nodes')
			const box: unknown[] = []
			client.on('NODE_REMOVED', (data: unknown) => box.push(data))
			;(zwave as any).sendToSocket('NODE_REMOVED', {
				id: NODE_ID_BROADCAST_LR,
			})
			await tick()

			expect(NODE_ID_BROADCAST_LR).toBe(4095)
			expect(box).toEqual([{ id: 4095 }])
		})

		it('NODE_REMOVED: full node object shape (ZwaveClient.ts:8022)', async () => {
			const zwave = realZwave()
			const client = await connectedSubscriber('nodes')
			const box: unknown[] = []
			client.on('NODE_REMOVED', (data: unknown) => box.push(data))

			const node = { id: 12, name: 'Removed node', ready: false }
			;(zwave as any).sendToSocket('NODE_REMOVED', node)
			await tick()

			expect(box).toEqual([node])
		})

		it('OTW_FIRMWARE_UPDATE: {progress} shape from the throttled progress bind (ZwaveClient.ts:6432)', async () => {
			const zwave = realZwave()
			const client = await connectedSubscriber('firmware')
			const box: unknown[] = []
			client.on('OTW_FIRMWARE_UPDATE', (data: unknown) => box.push(data))
			;(zwave as any).sendToSocket('OTW_FIRMWARE_UPDATE', {
				progress: { sentFragments: 3, totalFragments: 10 },
			})
			await tick()

			expect(box).toEqual([
				{ progress: { sentFragments: 3, totalFragments: 10 } },
			])
		})

		it('OTW_FIRMWARE_UPDATE: {result:{success,status}} shape from the direct finish call (ZwaveClient.ts:6450)', async () => {
			const zwave = realZwave()
			const client = await connectedSubscriber('firmware')
			const box: unknown[] = []
			client.on('OTW_FIRMWARE_UPDATE', (data: unknown) => box.push(data))
			;(zwave as any).sendToSocket('OTW_FIRMWARE_UPDATE', {
				result: { success: true, status: 'OK' },
			})
			await tick()

			expect(box).toEqual([{ result: { success: true, status: 'OK' } }])
		})

		it('NODE_FOUND: {node} shape (ZwaveClient.ts:6681)', async () => {
			const zwave = realZwave()
			const client = await connectedSubscriber('nodes')
			const box: unknown[] = []
			client.on('NODE_FOUND', (data: unknown) => box.push(data))
			;(zwave as any).sendToSocket('NODE_FOUND', {
				node: { id: 3, ready: false },
			})
			await tick()

			expect(box).toEqual([{ node: { id: 3, ready: false } }])
		})

		it('NODE_ADDED: {node, result} shape (ZwaveClient.ts:6728)', async () => {
			const zwave = realZwave()
			const client = await connectedSubscriber('nodes')
			const box: unknown[] = []
			client.on('NODE_ADDED', (data: unknown) => box.push(data))
			;(zwave as any).sendToSocket('NODE_ADDED', {
				node: { id: 3 },
				result: { success: true },
			})
			await tick()

			expect(box).toEqual([
				{ node: { id: 3 }, result: { success: true } },
			])
		})

		it('REBUILD_ROUTES_PROGRESS: array-of-tuples shape (ZwaveClient.ts:5201/5209/6795/5936)', async () => {
			const zwave = realZwave()
			const client = await connectedSubscriber('rebuild')
			const box: unknown[] = []
			client.on('REBUILD_ROUTES_PROGRESS', (data: unknown) =>
				box.push(data),
			)
			;(zwave as any).sendToSocket('REBUILD_ROUTES_PROGRESS', [
				[2, 'pending'],
			])
			await tick()

			expect(box).toEqual([[[2, 'pending']]])
		})

		it('HEALTH_CHECK_PROGRESS: {nodeId, ...} shape (ZwaveClient.ts:6827)', async () => {
			const zwave = realZwave()
			const client = await connectedSubscriber('diagnostics')
			const box: unknown[] = []
			client.on('HEALTH_CHECK_PROGRESS', (data: unknown) =>
				box.push(data),
			)
			;(zwave as any).sendToSocket('HEALTH_CHECK_PROGRESS', {
				nodeId: 2,
				rounds: 1,
			})
			await tick()

			expect(box).toEqual([{ nodeId: 2, rounds: 1 }])
		})

		it('LINK_RELIABILITY: {nodeId, ...} shape (ZwaveClient.ts:6842)', async () => {
			const zwave = realZwave()
			const client = await connectedSubscriber('diagnostics')
			const box: unknown[] = []
			client.on('LINK_RELIABILITY', (data: unknown) => box.push(data))
			;(zwave as any).sendToSocket('LINK_RELIABILITY', {
				nodeId: 2,
				rssi: -70,
			})
			await tick()

			expect(box).toEqual([{ nodeId: 2, rssi: -70 }])
		})

		it('GRANT_SECURITY_CLASSES/VALIDATE_DSK/INCLUSION_ABORTED: pass-through payload shapes routed to "nodes" (ZwaveClient.ts:6857/6883/6916)', async () => {
			const zwave = realZwave()
			const client = await connectedSubscriber('nodes')
			const events: Record<string, unknown[]> = {
				GRANT_SECURITY_CLASSES: [],
				VALIDATE_DSK: [],
				INCLUSION_ABORTED: [],
			}
			for (const evt of Object.keys(events)) {
				client.on(evt, (data: unknown) => events[evt].push(data))
			}

			;(zwave as any).sendToSocket('GRANT_SECURITY_CLASSES', {
				securityClasses: [0],
			})
			;(zwave as any).sendToSocket('VALIDATE_DSK', { dsk: 'abc' })
			;(zwave as any).sendToSocket('INCLUSION_ABORTED', true)
			await tick()

			expect(events.GRANT_SECURITY_CLASSES).toEqual([
				{ securityClasses: [0] },
			])
			expect(events.VALIDATE_DSK).toEqual([{ dsk: 'abc' }])
			expect(events.INCLUSION_ABORTED).toEqual([true])
		})

		it('NODE_EVENT: {nodeId, ...} shape routed to "nodes" (ZwaveClient.ts:7175)', async () => {
			const zwave = realZwave()
			const client = await connectedSubscriber('nodes')
			const box: unknown[] = []
			client.on('NODE_EVENT', (data: unknown) => box.push(data))
			;(zwave as any).sendToSocket('NODE_EVENT', {
				nodeId: 2,
				event: 'wake up',
			})
			await tick()

			expect(box).toEqual([{ nodeId: 2, event: 'wake up' }])
		})

		it('METADATA_UPDATED: value-metadata shape routed to "values" (ZwaveClient.ts:7693)', async () => {
			const zwave = realZwave()
			const client = await connectedSubscriber('values')
			const box: unknown[] = []
			client.on('METADATA_UPDATED', (data: unknown) => box.push(data))
			;(zwave as any).sendToSocket('METADATA_UPDATED', {
				nodeId: 2,
				commandClass: 37,
				metadata: { readable: true },
			})
			await tick()

			expect(box).toEqual([
				{ nodeId: 2, commandClass: 37, metadata: { readable: true } },
			])
		})

		it('VALUE_REMOVED: value-id shape routed to "values" (ZwaveClient.ts:8664)', async () => {
			const zwave = realZwave()
			const client = await connectedSubscriber('values')
			const box: unknown[] = []
			client.on('VALUE_REMOVED', (data: unknown) => box.push(data))
			;(zwave as any).sendToSocket('VALUE_REMOVED', {
				nodeId: 2,
				commandClass: 37,
				property: 'targetValue',
			})
			await tick()

			expect(box).toEqual([
				{ nodeId: 2, commandClass: 37, property: 'targetValue' },
			])
		})
	})

	describe('non-sendToSocket producers (bypass channel routing/nextTick entirely)', () => {
		it('DEBUG: the real log interceptor (app.ts setupInterceptor) forwards logStream data to the "debug" room synchronously', async () => {
			const { logStream } = await import('../../../api/lib/logger.ts')
			const client = harness.createClient()
			await harness.connectClient(client)
			await subscribe(client, ['debug'])

			const box: unknown[] = []
			client.on('DEBUG', (data: unknown) => box.push(data))

			logStream.write('a debug log line\n')
			await tick()

			expect(box).toEqual(['a debug log line\n'])
		})

		it('API_RETURN: emitted via a direct, unrouted socket.emit (no channel, ZwaveClient.ts:8931) - reaches every connected client regardless of subscriptions', async () => {
			const zwave = realZwave()
			const client = harness.createClient()
			await harness.connectClient(client)
			// Deliberately not subscribed to anything.
			const box: unknown[] = []
			client.on('API_RETURN', (data: unknown) => box.push(data))

			expect(eventToChannel.API_RETURN).toBeUndefined()
			const result = {
				success: true,
				message: 'Firmware update finished',
				result: true,
				api: 'firmwareUpdateOTW',
				args: [],
			}
			;(zwave as any).socket.emit('API_RETURN', result)
			await tick()

			expect(box).toEqual([result])
		})

		it('INIT: sendInitToSockets() force-emits the current state to every connected socket (ZwaveClient.ts:2676-2683), bypassing channel routing', async () => {
			const zwave = realZwave()
			const client = harness.createClient()
			await harness.connectClient(client)
			const box: unknown[] = []
			client.on('INIT', (data: unknown) => box.push(data))

			expect(eventToChannel.INIT).toBeUndefined()
			await (zwave as any).sendInitToSockets()
			await tick()

			expect(box).toHaveLength(1)
			const received = box[0] as any
			// `getState()`'s `info.uptime` ticks between the real send and
			// this assertion, and several fields default to `undefined`
			// (stripped over the wire) - assert the stable parts instead of
			// a fresh `zwave.getState()` snapshot.
			expect(received.nodes).toEqual([])
			expect(received.info).toMatchObject({
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
			const box: unknown[] = []
			client.on('ZNIFFER_STATE', (data: unknown) => box.push(data))

			const toSpy = vi.spyOn(harness.io, 'to')
			;(zniffer as any).onStateChange()

			// Unlike ZwaveClient.sendToSocket (which defers via
			// process.nextTick, see above), this call site routes
			// immediately, synchronously, from within `onStateChange()`
			// itself - `io.to(...)` is already called before this line
			// runs.
			expect(toSpy).toHaveBeenCalledWith('znifferState')
			toSpy.mockRestore()

			await tick()
			expect(box).toEqual([zniffer.status()])
		})
	})
})
