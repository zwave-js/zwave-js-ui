/**
 * Characterizes each outbound producer call site in `ZwaveClient.ts`/`ZnifferManager.ts`/`app.ts`: literal event name, payload shape, argument order, channel routing, and `process.nextTick` deferral where the real code defers.
 *
 * `ZwaveClient.sendToSocket` is the shared routing point for most of these events, looking up `eventToChannel[evtName]` to room-route - a real `ZWaveClient` drives this against the harness's real `io`, not a mock.
 *
 * Producers reachable only through a private method with no real public caller (e.g. handlers only ever bound inside `connect()` against a real zwave-js `Driver`) are intentionally not covered here - faking that much of the driver/node graph would test the fake more than the real code. Producers reachable through a genuinely public method (`rebuildNodeRoutes`, `checkLifelineHealth`, `checkLinkReliability`, `setUserCallbacks`, `emitNodeUpdate`, ...) are driven through that method instead.
 */
import {
	describe,
	it,
	expect,
	beforeAll,
	beforeEach,
	afterEach,
	vi,
	type MockInstance,
} from 'vitest'
import { CommandClasses, ZWaveDataRate, type Route } from '@zwave-js/core'
import { NODE_ID_BROADCAST_LR } from '@zwave-js/core'
import {
	Zniffer,
	type Driver,
	type InclusionGrant,
	type InclusionUserCallbacks,
	OTWFirmwareUpdateStatus,
} from 'zwave-js'
import type ZWaveClientType from '#api/lib/ZwaveClient'
import type { ZwaveConfig, ZUINode, ZUIValueId } from '#api/lib/ZwaveClient'
import type ZnifferManagerType from '#api/lib/ZnifferManager'
import { eventToChannel } from '#api/lib/SocketEvents'
import { buffer2hex } from '#api/lib/utils'
import { useSocketHarness, type SocketHarness } from './harness.ts'
import { createFakeGateway } from './fakes.ts'
import { connectedSubscriber, waitForEvent, waitForArgs } from './helpers.ts'

describe('Socket contract: outbound producers', () => {
	const getHarness = useSocketHarness()
	let ZWaveClient: typeof ZWaveClientType
	let ZnifferManager: typeof ZnifferManagerType

	beforeAll(async () => {
		// Registered after useSocketHarness()'s beforeAll, so STORE_DIR is isolated first
		;({ default: ZWaveClient } = await import('#api/lib/ZwaveClient'))
		;({ default: ZnifferManager } = await import(
			'#api/lib/ZnifferManager'
		))
	})

	// Connecting a client always runs the real 'clients' callback, which calls
	// gw.zwave?.setUserCallbacks() and throws if gw is undefined
	function benignGateway() {
		return createFakeGateway({ zwave: undefined })
	}

	// Wires the real ZWaveClient to the harness's real Socket.IO server.
	// The constructor only touches jsonStore, so this is safe without a real driver
	function realZwave(
		harness: SocketHarness,
		config: ZwaveConfig = {},
	): ZWaveClientType {
		return new ZWaveClient(config, harness.io)
	}

	// Minimal ZUINode fixture covering its required fields
	function fakeNode(overrides: Partial<ZUINode> & { id: number }): ZUINode {
		return {
			ready: false,
			available: true,
			failed: false,
			inited: false,
			eventsQueue: [],
			...overrides,
		}
	}

	// Minimal ZUIValueId fixture; nodeId/property vary per test
	function fakeValueId(
		overrides: Partial<ZUIValueId> &
			Pick<ZUIValueId, 'nodeId' | 'property'>,
	): ZUIValueId {
		return {
			id: 'fake-value-id',
			type: 'any',
			readable: true,
			writeable: true,
			default: undefined,
			stateless: false,
			ccSpecific: {},
			commandClass: CommandClasses['Binary Switch'],
			commandClassName: 'Binary Switch',
			...overrides,
		}
	}

	describe('sendToSocket mechanics (shared by most producers)', () => {
		it('routes NODE_UPDATED to its mapped channel and defers the actual emit via process.nextTick', async () => {
			const harness = await getHarness({ gateway: benignGateway() })
			const zwave = realZwave(harness)
			const client = await connectedSubscriber(harness, 'nodes')
			const received = waitForArgs(client, 'NODE_UPDATED')

			// Spies on the real io.to() call to prove the nextTick deferral directly in-process, rather than inferring it from wire-delivery timing
			const toSpy = vi.spyOn(harness.io, 'to')
			const node = fakeNode({ id: 9 })
			zwave.emitNodeUpdate(node)
			expect(toSpy).not.toHaveBeenCalled()

			await new Promise<void>((resolve) => process.nextTick(resolve))
			expect(toSpy).toHaveBeenCalledWith('nodes')
			toSpy.mockRestore()

			expect(eventToChannel.NODE_UPDATED).toBe('nodes')
			expect(await received).toEqual([node, false])
		})
	})

	describe('real producer methods', () => {
		it('emitValueChanged() sends VALUE_UPDATED with the mutated valueId when changed=true', async () => {
			const harness = await getHarness({ gateway: benignGateway() })
			const zwave = realZwave(harness)
			zwave['_driver'] = {
				controller: { nodes: { get: () => undefined } },
			} as unknown as Driver
			const client = await connectedSubscriber(harness, 'values')
			const received = waitForEvent<{
				nodeId: number
				lastUpdate: number
			}>(client, 'VALUE_UPDATED')

			const valueId = fakeValueId({ nodeId: 2, property: 'x' })
			zwave.emitValueChanged(valueId, fakeNode({ id: 2 }), true)

			const data = await received
			expect(data.nodeId).toBe(2)
			expect(data.lastUpdate).toEqual(expect.any(Number))
		})

		it('emitValueChanged() sends nothing when changed=false', async () => {
			const harness = await getHarness({ gateway: benignGateway() })
			const zwave = realZwave(harness)
			zwave['_driver'] = {
				controller: { nodes: { get: () => undefined } },
			} as unknown as Driver
			const client = await connectedSubscriber(harness, 'values')
			const box: unknown[] = []
			client.on('VALUE_UPDATED', (data: unknown) => box.push(data))

			zwave.emitValueChanged(
				fakeValueId({ nodeId: 2, property: 'x' }),
				fakeNode({ id: 2 }),
				false,
			)

			// Fires a second, distinct, definitely-emitting call on the same channel and awaits that instead of a fixed sleep: FIFO per-connection delivery means an incorrect emit above would already have arrived
			const marker = waitForEvent<{ nodeId: number }>(
				client,
				'VALUE_UPDATED',
			)
			zwave.emitValueChanged(
				fakeValueId({ nodeId: 99, property: 'marker' }),
				fakeNode({ id: 99 }),
				true,
			)
			await marker

			expect(box).toHaveLength(1)
			expect((box[0] as { nodeId: number }).nodeId).toBe(99)
		})

		it('emitStatistics() converts every null prop to false, leaves others untouched', async () => {
			const harness = await getHarness({ gateway: benignGateway() })
			const zwave = realZwave(harness)
			const client = await connectedSubscriber(harness, 'statistics')
			const received = waitForEvent(client, 'STATISTICS')

			const applicationRoute: Route = {
				repeaters: [],
				routeSpeed: ZWaveDataRate['9k6'],
			}
			zwave.emitStatistics(fakeNode({ id: 5 }), {
				statistics: null,
				lastActive: null,
				applicationRoute,
			})

			expect(await received).toEqual({
				nodeId: 5,
				statistics: false,
				lastActive: false,
				applicationRoute,
			})
		})

		it('emitNodeUpdate() sends the FULL node with isPartial=false when no changedProps are given', async () => {
			const harness = await getHarness({ gateway: benignGateway() })
			const zwave = realZwave(harness)
			const client = await connectedSubscriber(harness, 'nodes')
			const received = waitForArgs(client, 'NODE_UPDATED')

			const node = fakeNode({ id: 7, ready: true })
			zwave.emitNodeUpdate(node)

			expect(await received).toEqual([node, false])
		})

		it('emitNodeUpdate() sends only changedProps (+id) with isPartial=true for a partial update', async () => {
			const harness = await getHarness({ gateway: benignGateway() })
			const zwave = realZwave(harness)
			const client = await connectedSubscriber(harness, 'nodes')
			const received = waitForArgs(client, 'NODE_UPDATED')

			const node = fakeNode({ id: 7, ready: true })
			zwave.emitNodeUpdate(node, { status: 'Alive' })

			expect(await received).toEqual([{ status: 'Alive', id: 7 }, true])
		})

		it('_updateControllerStatus() sends CONTROLLER_CMD with status (error/inclusionState default to undefined, stripped over the wire)', async () => {
			const harness = await getHarness({ gateway: benignGateway() })
			const zwave = realZwave(harness)
			const client = await connectedSubscriber(harness, 'controller')
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
			const harness = await getHarness({ gateway: benignGateway() })
			const zwave = realZwave(harness)
			const client = await connectedSubscriber(harness, 'controller')
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

		it("checkForConfigUpdates() sends INFO with getInfo()'s real payload", async () => {
			const harness = await getHarness({ gateway: benignGateway() })
			const zwave = realZwave(harness)
			zwave['_driver'] = {
				checkForConfigUpdates: vi.fn(() => Promise.resolve('1.2.3')),
			} as unknown as Driver
			zwave.driverReady = true
			const client = await connectedSubscriber(harness, 'controller')
			const received = waitForEvent<{
				appVersion: string
				zwaveVersion: string
			}>(client, 'INFO')

			const newVersion = await zwave.checkForConfigUpdates()

			expect(newVersion).toBe('1.2.3')
			const data = await received
			expect(data.appVersion).toEqual(expect.any(String))
			expect(data.zwaveVersion).toEqual(expect.any(String))
		})

		it('_deleteGroup() sends NODE_REMOVED with the deleted group id', async () => {
			const harness = await getHarness({ gateway: benignGateway() })
			const groupId = 0x1000
			await harness.jsonStore.put(harness.store.groups, [
				{ id: groupId, name: 'Test group', nodeIds: [] },
			])
			const zwave = realZwave(harness)
			const client = await connectedSubscriber(harness, 'nodes')
			const received = waitForEvent(client, 'NODE_REMOVED')

			const deleted = await zwave._deleteGroup(groupId)

			expect(deleted).toBe(true)
			expect(await received).toEqual({ id: groupId })
		})
	})

	describe('additional real literals/shapes: driven through their real producing method/handler', () => {
		it('REBUILD_ROUTES_PROGRESS: array-of-tuples shape, via the real public rebuildNodeRoutes()', async () => {
			const harness = await getHarness({ gateway: benignGateway() })
			const zwave = realZwave(harness)
			zwave.driverReady = true
			zwave.nodes.set(2, fakeNode({ id: 2 }))
			zwave['_driver'] = {
				controller: {
					rebuildNodeRoutes: vi.fn(() => Promise.resolve(true)),
					getCustomSUCReturnRoutesCached: () => [],
					getPrioritySUCReturnRouteCached: () => ({}),
				},
			} as unknown as Driver
			const client = await connectedSubscriber(harness, 'rebuild')
			const received = waitForEvent(client, 'REBUILD_ROUTES_PROGRESS')

			const result = await zwave.rebuildNodeRoutes(2)

			expect(result).toBe(true)
			// waitForEvent's `once` only captures the first of the 2 real emits (pending, then done/failed)
			expect(await received).toEqual([[2, 'pending']])
		})

		it('HEALTH_CHECK_PROGRESS: {request, round, totalRounds, lastRating, lastResult} shape, via the real public checkLifelineHealth()', async () => {
			const harness = await getHarness({ gateway: benignGateway() })
			const zwave = realZwave(harness)
			zwave.driverReady = true
			const fakeZwaveNode = {
				checkLifelineHealth: (
					rounds: number,
					onProgress: (
						round: number,
						totalRounds: number,
						lastRating: number,
						lastResult: unknown,
					) => void,
				) => {
					onProgress(1, rounds, 8, { rating: 8 })
					return Promise.resolve({ rating: 8 })
				},
			}
			zwave['_driver'] = {
				controller: {
					ownNodeId: 1,
					nodes: { get: () => fakeZwaveNode },
				},
			} as unknown as Driver
			const client = await connectedSubscriber(harness, 'diagnostics')
			const received = waitForEvent(client, 'HEALTH_CHECK_PROGRESS')

			const result = await zwave.checkLifelineHealth(2, 3)

			expect(await received).toEqual({
				request: { nodeId: 2, targetNodeId: 1 },
				round: 1,
				totalRounds: 3,
				lastRating: 8,
				lastResult: { rating: 8 },
			})
			expect(result).toEqual({ rating: 8, targetNodeId: 1 })
		})

		it('LINK_RELIABILITY: {request, args} shape, via the real public checkLinkReliability()', async () => {
			const harness = await getHarness({ gateway: benignGateway() })
			const zwave = realZwave(harness)
			zwave.driverReady = true
			const fakeZwaveNode = {
				checkLinkReliability: (options: {
					onProgress: (progress: unknown) => void
				}) => {
					options.onProgress({ rssi: -70 })
					return Promise.resolve({ rssi: -70 })
				},
			}
			zwave['_driver'] = {
				controller: { nodes: { get: () => fakeZwaveNode } },
			} as unknown as Driver
			const client = await connectedSubscriber(harness, 'diagnostics')
			const received = waitForEvent(client, 'LINK_RELIABILITY')

			const result = await zwave.checkLinkReliability(2, {})

			expect(await received).toEqual({
				request: { nodeId: 2 },
				args: [{ rssi: -70 }],
			})
			expect(result).toEqual({ rssi: -70 })
		})

		it('GRANT_SECURITY_CLASSES/VALIDATE_DSK/INCLUSION_ABORTED: real _onGrantSecurityClasses()/_onValidateDSK()/_onAbortInclusion(), reached via the real public setUserCallbacks() hookup', async () => {
			const harness = await getHarness({ gateway: benignGateway() })
			const zwave = realZwave(harness, { serverEnabled: true })
			let inclusionUserCallbacks: InclusionUserCallbacks | undefined
			zwave['_driver'] = {
				updateOptions: (opts: {
					inclusionUserCallbacks?: InclusionUserCallbacks
				}) => {
					inclusionUserCallbacks = opts.inclusionUserCallbacks
				},
			} as unknown as Driver

			const client = await connectedSubscriber(harness, 'nodes')
			const grantReceived = waitForEvent(client, 'GRANT_SECURITY_CLASSES')
			const dskReceived = waitForEvent(client, 'VALIDATE_DSK')
			const abortReceived = waitForEvent(client, 'INCLUSION_ABORTED')

			// setUserCallbacks() is the public hookup point a real driver uses to reach these handlers.
			// Invoking the same bound functions it hands off drives the identical code path.
			zwave.setUserCallbacks()
			if (!inclusionUserCallbacks) {
				throw new Error('Expected inclusion user callbacks')
			}
			expect(inclusionUserCallbacks).toStrictEqual({
				grantSecurityClasses: expect.any(Function),
				validateDSKAndEnterPIN: expect.any(Function),
				abort: expect.any(Function),
			})

			// Both promises only settle via a separate confirmation call this test never makes, so both are intentionally unawaited
			// InclusionGrant also requires `clientSideAuth`, left out since the assertion below doesn't check it
			void inclusionUserCallbacks.grantSecurityClasses({
				securityClasses: [0],
			} as InclusionGrant)
			void inclusionUserCallbacks.validateDSKAndEnterPIN('abc')
			inclusionUserCallbacks.abort()

			expect(await grantReceived).toEqual({ securityClasses: [0] })
			expect(await dskReceived).toBe('abc')
			expect(await abortReceived).toBe(true)
		})

		it('NODE_REMOVED: {id: NODE_ID_BROADCAST_LR} via the real _refreshBroadcastLRNode()', async () => {
			const harness = await getHarness({ gateway: benignGateway() })
			const zwave = realZwave(harness)
			zwave.driverReady = true
			;(zwave as any)._driver = {
				controller: { supportsLongRange: false, nodes: new Map() },
			}
			// Pre-populate as if the LR broadcast virtual node already
			// existed, with the controller reporting no long-range
			// support - the precondition under which the real method
			// removes it and emits NODE_REMOVED.
			;(zwave as any)._virtualNodes.set(NODE_ID_BROADCAST_LR, {} as any)
			;(zwave as any)._nodes.set(NODE_ID_BROADCAST_LR, {} as any)
			const client = await connectedSubscriber(harness, 'nodes')
			const received = waitForEvent(client, 'NODE_REMOVED')
			;(zwave as any)._refreshBroadcastLRNode()

			expect(await received).toEqual({ id: NODE_ID_BROADCAST_LR })
		})

		it('NODE_REMOVED: full node object shape via the real _removeNode()', async () => {
			const harness = await getHarness({ gateway: benignGateway() })
			const zwave = realZwave(harness)
			;(zwave as any).storeNodes = {}
			const node = { id: 12, name: 'Removed node', ready: false }
			;(zwave as any)._nodes.set(12, node)
			const client = await connectedSubscriber(harness, 'nodes')
			const received = waitForEvent(client, 'NODE_REMOVED')
			;(zwave as any)._removeNode(12)

			expect(await received).toEqual(node)
		})

		it('OTW_FIRMWARE_UPDATE: {progress} via the real, throttled _onOTWFirmwareUpdateProgress()', async () => {
			const harness = await getHarness({ gateway: benignGateway() })
			const zwave = realZwave(harness)
			const client = await connectedSubscriber(harness, 'firmware')
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

		it('OTW_FIRMWARE_UPDATE: {result:{success,status}} via the real _onOTWFirmwareUpdateFinished()', async () => {
			const harness = await getHarness({ gateway: benignGateway() })
			const zwave = realZwave(harness)
			const client = await connectedSubscriber(harness, 'firmware')
			const received = waitForEvent(client, 'OTW_FIRMWARE_UPDATE')

			;(zwave as any)._onOTWFirmwareUpdateFinished({
				success: true,
				// The real method runs the status through
				// `getEnumMemberName()`, which is why the wire payload
				// below asserts the STRING name, not the enum value.
				status: OTWFirmwareUpdateStatus.OK,
			})

			expect(await received).toEqual({
				result: { success: true, status: 'OK' },
			})
		})

		it('NODE_FOUND: {node} via the real _onNodeFound()', async () => {
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

		it('NODE_EVENT: {nodeId, ...} via the real _onNodeEvent() handler', async () => {
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
	})

	describe('non-sendToSocket producers (bypass channel routing/nextTick entirely)', () => {
		it('DEBUG: the real log interceptor (app.ts setupInterceptor) forwards logStream data to the "debug" room synchronously', async () => {
			const harness = await getHarness({
				gateway: benignGateway(),
			})
			const { logStream } = await import('#api/lib/logger')
			const client = await connectedSubscriber(harness, 'debug')

			const received = waitForEvent(client, 'DEBUG')
			logStream.write('a debug log line\n')

			expect(await received).toBe('a debug log line\n')
		})

		describe('API_RETURN: its only real producer is unreachable in an automated test', () => {
			// The only real producer sits inside emulateFwUpdate(), a private helper gated behind
			// Math.random()/setInterval timing. Verified structurally, not via a fabricated emit.
			it('is not in allowedApis, so it is unreachable through callApi() too', async () => {
				const { allowedApis } = await import('#api/lib/ZwaveClient')
				expect(allowedApis).not.toContain('emulateFwUpdate')
			})

			it('is declared with no channel mapping (would bypass room routing entirely, like INIT below, if it were ever reachable)', () => {
				expect(eventToChannel.API_RETURN).toBeUndefined()
			})
		})

		describe('INIT: its only real producer is unreachable in an automated test', () => {
			// sendInitToSockets() is private, reachable only via _onDriverReady() inside connect()
			// against a real Driver. Too broad to fake honestly, so verified structurally instead.
			it('is declared with no channel mapping (force-sent to every connected socket, bypassing room routing entirely)', () => {
				expect(eventToChannel.INIT).toBeUndefined()
			})
		})

		describe('Zniffer producers: driven through the real internal Zniffer instance', () => {
			// Zniffer's constructor validates only port's type; real serial I/O starts in
			// .init()/.setFrequency(), so only those (plus .destroy() for teardown) are stubbed.
			// ZnifferManager's own logic - onStateChange(), the frame listeners - stays live.
			let initSpy: MockInstance<() => Promise<void>>
			let setFrequencySpy: MockInstance<
				(frequency: number) => Promise<void>
			>
			let destroySpy: MockInstance<() => Promise<void>>

			beforeEach(() => {
				initSpy = vi
					.spyOn(Zniffer.prototype, 'init')
					.mockResolvedValue(undefined)
				setFrequencySpy = vi
					.spyOn(Zniffer.prototype, 'setFrequency')
					.mockResolvedValue(undefined)
				// Real .destroy() tears down internal loggers only set up by a real .init(), so it's stubbed too purely to keep ZnifferManager.close() a safe no-crash cleanup step
				destroySpy = vi
					.spyOn(Zniffer.prototype, 'destroy')
					.mockResolvedValue(undefined)
			})

			afterEach(() => {
				initSpy.mockRestore()
				setFrequencySpy.mockRestore()
				destroySpy.mockRestore()
			})

			it('ZNIFFER_STATE: real ZnifferManager.setFrequency() routes its status() payload to the "znifferState" room', async () => {
				const harness = await getHarness({ gateway: benignGateway() })
				const znifferManager = new ZnifferManager(
					{ enabled: true, port: '/dev/ttyFAKE' },
					harness.io,
				)
				try {
					const client = await connectedSubscriber(
						harness,
						'znifferState',
					)
					const received = waitForEvent(client, 'ZNIFFER_STATE')

					await znifferManager.setFrequency(916)

					expect(await received).toEqual(znifferManager.status())
				} finally {
					await znifferManager.close()
				}
			})
		})
	})
})
