import { describe, it, expect, vi } from 'vitest'
import { AssociationCheckResult } from 'zwave-js'
import { AssociationService } from '../../../api/lib/zwave/AssociationService.ts'
import type {
	AssociationDriverPort,
	AssociationNodeStorePort,
	AssociationLogPort,
	AssociationNodeState,
} from '../../../api/lib/zwave/ports.ts'
import type { Driver, ZWaveNode } from 'zwave-js'

// ---------------------------------------------------------------------------
// Helpers: minimal fakes for ports
// ---------------------------------------------------------------------------

function makeZWaveNode(
	overrides: Partial<{
		id: number
		refreshCCValues: () => Promise<void>
	}> = {},
): ZWaveNode {
	return {
		id: overrides.id ?? 2,
		refreshCCValues: vi.fn(
			overrides.refreshCCValues ?? (() => Promise.resolve()),
		),
	} as unknown as ZWaveNode
}

function makeControllerDriver(controller: Record<string, unknown>): Driver {
	return { controller } as unknown as Driver
}

function createDriverPort(
	controllerOverrides: Partial<{
		getAllAssociationGroups: (nodeId: number) => unknown
		getAllAssociations: (nodeId: number) => unknown
		checkAssociation: (...args: unknown[]) => AssociationCheckResult
		addAssociations: (...args: unknown[]) => Promise<void>
		removeAssociations: (...args: unknown[]) => Promise<void>
		removeNodeFromAllAssociations: (nodeId: number) => Promise<void>
	}> = {},
	driverNull = false,
): AssociationDriverPort & { controller: Record<string, unknown> } {
	const controller = {
		getAllAssociationGroups: vi.fn(
			controllerOverrides.getAllAssociationGroups ?? (() => new Map()),
		),
		getAllAssociations: vi.fn(
			controllerOverrides.getAllAssociations ?? (() => new Map()),
		),
		checkAssociation: vi.fn(
			controllerOverrides.checkAssociation ??
				(() => AssociationCheckResult.OK),
		),
		addAssociations: vi.fn(
			controllerOverrides.addAssociations ?? (() => Promise.resolve()),
		),
		removeAssociations: vi.fn(
			controllerOverrides.removeAssociations ?? (() => Promise.resolve()),
		),
		removeNodeFromAllAssociations: vi.fn(
			controllerOverrides.removeNodeFromAllAssociations ??
				(() => Promise.resolve()),
		),
	}
	const driver = makeControllerDriver(controller)
	return {
		getDriver: () => (driverNull ? null : driver),
		controller,
	}
}

function createNodeStorePort(
	nodes: Record<number, { zwave?: ZWaveNode; zui?: AssociationNodeState }>,
): AssociationNodeStorePort & {
	updates: Array<{ node: AssociationNodeState; changed: unknown }>
} {
	const updates: Array<{ node: AssociationNodeState; changed: unknown }> = []
	return {
		getZWaveNode: (nodeId: number) => nodes[nodeId]?.zwave,
		getZUINode: (nodeId: number) => nodes[nodeId]?.zui,
		emitNodeUpdate: vi.fn(
			(node: AssociationNodeState, changed: unknown) => {
				updates.push({ node, changed })
			},
		),
		updates,
	}
}

function createLogPort(): AssociationLogPort & {
	calls: Array<{ nodeId: number; level: string; message: string }>
} {
	const calls: Array<{ nodeId: number; level: string; message: string }> = []
	return {
		logNode: vi.fn((nodeId: number, level: string, message: string) => {
			calls.push({ nodeId, level, message })
		}),
		calls,
	}
}

function createService(
	nodes: Record<number, { zwave?: ZWaveNode; zui?: AssociationNodeState }>,
	driverOverrides: Parameters<typeof createDriverPort>[0] = {},
	driverNull = false,
) {
	const driver = createDriverPort(driverOverrides, driverNull)
	const nodeStore = createNodeStorePort(nodes)
	const log = createLogPort()
	const service = new AssociationService(driver, nodeStore, log)
	return { service, driver, nodeStore, log }
}

/**
 * A manually-resolvable promise, used to deterministically control exactly
 * when an awaited call inside the service resolves, so a test can swap the
 * driver *while* the service is suspended on that `await` and assert which
 * driver instance is observed afterwards.
 */
function createDeferred<T = void>(): {
	promise: Promise<T>
	resolve: (value: T | PromiseLike<T>) => void
	reject: (reason?: unknown) => void
} {
	let resolve!: (value: T | PromiseLike<T>) => void
	let reject!: (reason?: unknown) => void
	const promise = new Promise<T>((res, rej) => {
		resolve = res
		reject = rej
	})
	return { promise, resolve, reject }
}

/**
 * A driver port whose `getDriver()` result can be swapped mid-test via
 * `set()`. Used to deterministically simulate a driver restart occurring
 * while a service method is suspended on an `await`, proving the *current*
 * driver is re-resolved at each use site instead of a stale reference
 * captured before the `await` being reused afterwards.
 */
function createMutableDriverPort(
	initial: Driver | null,
): AssociationDriverPort & {
	set: (driver: Driver | null) => void
} {
	let current = initial
	return {
		getDriver: () => current,
		set: (driver: Driver | null) => {
			current = driver
		},
	}
}

const source = { nodeId: 2 }
const association = { nodeId: 3 }

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AssociationService', () => {
	describe('getGroups', () => {
		it('populates node.groups from the controller association groups and emits an update', () => {
			const zwave = makeZWaveNode({ id: 2 })
			const zui: AssociationNodeState = { id: 2 }
			const { service, driver, nodeStore } = createService({
				2: { zwave, zui },
			})
			const endpointGroups = new Map([
				[
					0,
					new Map([
						[
							1,
							{
								label: 'Lifeline',
								maxNodes: 5,
								isLifeline: true,
								multiChannel: false,
							},
						],
					]),
				],
			])
			driver.controller.getAllAssociationGroups = vi.fn(
				() => endpointGroups,
			)

			service.getGroups(2)

			expect(zui.groups).toEqual([
				{
					title: 'Lifeline',
					endpoint: 0,
					value: 1,
					maxNodes: 5,
					isLifeline: true,
					multiChannel: false,
				},
			])
			expect(nodeStore.updates).toEqual([
				{ node: zui, changed: { groups: zui.groups } },
			])
		})

		it('skips emitNodeUpdate when ignoreUpdate is true', () => {
			const { service, nodeStore } = createService({
				2: { zwave: makeZWaveNode({ id: 2 }), zui: { id: 2 } },
			})

			service.getGroups(2, true)

			expect(nodeStore.updates).toEqual([])
		})

		it('logs a warning and leaves groups empty when the controller call throws', () => {
			const zui: AssociationNodeState = { id: 2 }
			const { service, driver, log } = createService({
				2: { zwave: makeZWaveNode({ id: 2 }), zui },
			})
			driver.controller.getAllAssociationGroups = vi.fn(() => {
				throw new Error('not supported')
			})

			service.getGroups(2)

			expect(zui.groups).toEqual([])
			expect(log.calls).toContainEqual(
				expect.objectContaining({
					nodeId: 2,
					level: 'warn',
					message: expect.stringContaining('not supported'),
				}),
			)
		})

		it('does nothing when the ZWave node or ZUI node is missing, but still emits update if node exists', () => {
			const zui: AssociationNodeState = { id: 5 }
			const { service, nodeStore } = createService({
				5: { zui }, // no zwave node
			})

			service.getGroups(5)

			expect(zui.groups).toBeUndefined()
			expect(nodeStore.updates).toEqual([
				{ node: zui, changed: { groups: undefined } },
			])
		})

		it('resets groups to empty and logs a warning when the driver is not ready (matches original unconditional reset)', () => {
			const zui: AssociationNodeState = { id: 2 }
			const { service, nodeStore, log } = createService(
				{ 2: { zwave: makeZWaveNode({ id: 2 }), zui } },
				{},
				true,
			)

			service.getGroups(2)

			// Original ZwaveClient reset `node.groups = []` unconditionally
			// whenever the node/ZUI-node pair was found, even if fetching
			// groups failed (including a torn-down/missing driver) - it was
			// never left as `undefined`.
			expect(zui.groups).toEqual([])
			expect(log.calls).toContainEqual(
				expect.objectContaining({
					nodeId: 2,
					level: 'warn',
					message: expect.stringContaining(
						'Error while fetching groups associations',
					),
				}),
			)
			expect(nodeStore.updates).toEqual([
				{ node: zui, changed: { groups: [] } },
			])
		})
	})

	describe('getAssociations', () => {
		it('collects associations from the controller map', async () => {
			const { service, driver } = createService({
				2: { zwave: makeZWaveNode({ id: 2 }) },
			})
			driver.controller.getAllAssociations = vi.fn(
				() =>
					new Map([
						[
							{ nodeId: 2, endpoint: undefined },
							new Map([
								[
									1,
									[
										{ nodeId: 3, endpoint: undefined },
										{ nodeId: 4, endpoint: 1 },
									],
								],
							]),
						],
					]),
			)

			const result = await service.getAssociations(2)

			expect(result).toEqual([
				{
					endpoint: undefined,
					groupId: 1,
					nodeId: 3,
					targetEndpoint: undefined,
				},
				{
					endpoint: undefined,
					groupId: 1,
					nodeId: 4,
					targetEndpoint: 1,
				},
			])
		})

		it('refreshes Association and Multi Channel Association CC values when refresh=true', async () => {
			const refreshCCValues = vi.fn(() => Promise.resolve())
			const zwave = makeZWaveNode({ id: 2, refreshCCValues })
			const { service } = createService({ 2: { zwave } })

			await service.getAssociations(2, true)

			expect(refreshCCValues).toHaveBeenCalledTimes(2)
		})

		it('logs a warning and returns collected-so-far results when an error is thrown', async () => {
			const { service, driver, log } = createService({
				2: { zwave: makeZWaveNode({ id: 2 }) },
			})
			driver.controller.getAllAssociations = vi.fn(() => {
				throw new Error('boom')
			})

			const result = await service.getAssociations(2)

			expect(result).toEqual([])
			expect(log.calls).toContainEqual(
				expect.objectContaining({ nodeId: 2, level: 'warn' }),
			)
		})

		it('logs a warning and returns an empty array when the node or driver is missing', async () => {
			const { service, log } = createService({})

			const result = await service.getAssociations(99)

			expect(result).toEqual([])
			expect(log.calls).toContainEqual(
				expect.objectContaining({
					nodeId: 99,
					level: 'warn',
					message: expect.stringContaining('node not found'),
				}),
			)
		})

		it('logs a warning and returns an empty array when the node exists but the driver is not ready', async () => {
			const { service, log } = createService(
				{ 2: { zwave: makeZWaveNode({ id: 2 }) } },
				{},
				true,
			)

			const result = await service.getAssociations(2)

			expect(result).toEqual([])
			expect(log.calls).toContainEqual(
				expect.objectContaining({
					nodeId: 2,
					level: 'warn',
					message: expect.stringContaining('Driver not ready'),
				}),
			)
		})

		it('re-resolves the driver after the refresh awaits, observing a mid-flight restart (mutable port, deferred)', async () => {
			const oldController = {
				getAllAssociations: vi.fn(() => new Map()),
			}
			const newController = {
				getAllAssociations: vi.fn(
					() =>
						new Map([
							[
								{ nodeId: 2, endpoint: undefined },
								new Map([
									[1, [{ nodeId: 9, endpoint: undefined }]],
								]),
							],
						]),
				),
			}
			const oldDriver = makeControllerDriver(oldController)
			const newDriver = makeControllerDriver(newController)
			const driverPort = createMutableDriverPort(oldDriver)

			const deferred = createDeferred<void>()
			const refreshCCValues = vi.fn(() => deferred.promise)
			const zwave = makeZWaveNode({ id: 2, refreshCCValues })
			const nodeStore = createNodeStorePort({ 2: { zwave } })
			const log = createLogPort()
			const service = new AssociationService(driverPort, nodeStore, log)

			const resultPromise = service.getAssociations(2, true)

			// Still suspended on the refresh await - neither driver's
			// controller has been touched yet.
			expect(oldController.getAllAssociations).not.toHaveBeenCalled()
			expect(newController.getAllAssociations).not.toHaveBeenCalled()

			// Simulate a driver restart completing while the CC refresh is
			// still in flight, then let the refresh resolve.
			driverPort.set(newDriver)
			deferred.resolve()

			const result = await resultPromise

			// The post-await driver read must observe the NEW driver, never
			// the stale one captured (if it had been) before the awaits.
			expect(oldController.getAllAssociations).not.toHaveBeenCalled()
			expect(newController.getAllAssociations).toHaveBeenCalledWith(2)
			expect(result).toEqual([
				{
					endpoint: undefined,
					groupId: 1,
					nodeId: 9,
					targetEndpoint: undefined,
				},
			])
		})
	})

	describe('checkAssociation', () => {
		it('delegates to driver.controller.checkAssociation', () => {
			const { service, driver } = createService({})
			driver.controller.checkAssociation = vi.fn(
				() => AssociationCheckResult.Forbidden_SelfAssociation,
			)

			const result = service.checkAssociation(source, 1, association)

			expect(result).toBe(
				AssociationCheckResult.Forbidden_SelfAssociation,
			)
			expect(driver.controller.checkAssociation).toHaveBeenCalledWith(
				source,
				1,
				association,
			)
		})

		it('throws when the driver is not ready', () => {
			const { service } = createService({}, {}, true)

			expect(() =>
				service.checkAssociation(source, 1, association),
			).toThrow('Driver not ready')
		})
	})

	describe('addAssociations', () => {
		it('throws when the source node is not found', async () => {
			const { service } = createService({})

			await expect(
				service.addAssociations(source, 1, [association]),
			).rejects.toThrow('Node 2 not found')
		})

		it('throws "Driver not ready" when the driver is not ready (node present, association attempted)', async () => {
			const { service } = createService(
				{ 2: { zwave: makeZWaveNode({ id: 2 }) } },
				{},
				true,
			)

			// Original ZwaveClient had no upfront driver guard here either -
			// it let the (then-uncaught) controller access fail once the
			// loop actually needed the driver. `associations` is non-empty
			// here so the loop body runs and the driver is required.
			await expect(
				service.addAssociations(source, 1, [association]),
			).rejects.toThrow('Driver not ready')
		})

		it('does not require the driver at all when associations is empty (matches original: loop body never runs)', async () => {
			const { service, driver } = createService(
				{ 2: { zwave: makeZWaveNode({ id: 2 }) } },
				{},
				true,
			)

			const result = await service.addAssociations(source, 1, [])

			expect(result).toEqual([])
			expect(driver.controller.checkAssociation).not.toHaveBeenCalled()
		})

		it('adds an association when the check result is OK', async () => {
			const { service, driver, log } = createService({
				2: { zwave: makeZWaveNode({ id: 2 }) },
			})

			const result = await service.addAssociations(source, 1, [
				association,
			])

			expect(result).toEqual([AssociationCheckResult.OK])
			expect(driver.controller.addAssociations).toHaveBeenCalledWith(
				source,
				1,
				[association],
				{ force: false },
			)
			expect(log.calls).toContainEqual(
				expect.objectContaining({
					level: 'info',
					message: expect.stringContaining('Adding'),
				}),
			)
		})

		it('skips adding and logs a warning when the check result is not OK and force is not set', async () => {
			const { service, driver, log } = createService({
				2: { zwave: makeZWaveNode({ id: 2 }) },
			})
			driver.controller.checkAssociation = vi.fn(
				() => AssociationCheckResult.Forbidden_SelfAssociation,
			)

			const result = await service.addAssociations(source, 1, [
				association,
			])

			expect(result).toEqual([
				AssociationCheckResult.Forbidden_SelfAssociation,
			])
			expect(driver.controller.addAssociations).not.toHaveBeenCalled()
			expect(log.calls).toContainEqual(
				expect.objectContaining({
					level: 'warn',
					message: expect.stringContaining('Unable to add'),
				}),
			)
		})

		it('force-adds and logs a warning bypass message when the check result is not OK but force is set', async () => {
			const { service, driver, log } = createService({
				2: { zwave: makeZWaveNode({ id: 2 }) },
			})
			driver.controller.checkAssociation = vi.fn(
				() => AssociationCheckResult.Forbidden_SelfAssociation,
			)

			const result = await service.addAssociations(
				source,
				1,
				[association],
				{ force: true },
			)

			expect(result).toEqual([
				AssociationCheckResult.Forbidden_SelfAssociation,
			])
			expect(driver.controller.addAssociations).toHaveBeenCalledWith(
				source,
				1,
				[association],
				{ force: true },
			)
			expect(log.calls).toContainEqual(
				expect.objectContaining({
					level: 'warn',
					message: expect.stringContaining('Force adding'),
				}),
			)
		})

		it('adds normally (not forced) when force is set but the check result is already OK', async () => {
			const { service, driver, log } = createService({
				2: { zwave: makeZWaveNode({ id: 2 }) },
			})

			await service.addAssociations(source, 1, [association], {
				force: true,
			})

			expect(log.calls).toContainEqual(
				expect.objectContaining({
					level: 'info',
					message: expect.stringContaining('Adding'),
				}),
			)
		})

		it('processes each association independently, accumulating results', async () => {
			const { service, driver } = createService({
				2: { zwave: makeZWaveNode({ id: 2 }) },
			})
			let call = 0
			driver.controller.checkAssociation = vi.fn(() =>
				call++ === 0
					? AssociationCheckResult.OK
					: AssociationCheckResult.Forbidden_SelfAssociation,
			)

			const result = await service.addAssociations(source, 1, [
				{ nodeId: 3 },
				{ nodeId: 4 },
			])

			expect(result).toEqual([
				AssociationCheckResult.OK,
				AssociationCheckResult.Forbidden_SelfAssociation,
			])
			expect(driver.controller.addAssociations).toHaveBeenCalledTimes(1)
		})

		it('re-resolves the driver on every iteration, observing a mid-flight restart (mutable port, deferred)', async () => {
			const deferred = createDeferred<void>()
			const oldController = {
				checkAssociation: vi.fn(() => AssociationCheckResult.OK),
				addAssociations: vi.fn(() => deferred.promise),
			}
			const newController = {
				checkAssociation: vi.fn(() => AssociationCheckResult.OK),
				addAssociations: vi.fn(() => Promise.resolve()),
			}
			const oldDriver = makeControllerDriver(oldController)
			const newDriver = makeControllerDriver(newController)
			const driverPort = createMutableDriverPort(oldDriver)

			const zwave = makeZWaveNode({ id: 2 })
			const nodeStore = createNodeStorePort({ 2: { zwave } })
			const log = createLogPort()
			const service = new AssociationService(driverPort, nodeStore, log)

			const resultPromise = service.addAssociations(source, 1, [
				{ nodeId: 3 },
				{ nodeId: 4 },
			])

			// First iteration is in flight against the OLD driver, suspended
			// on the (deferred) addAssociations call.
			expect(oldController.checkAssociation).toHaveBeenCalledTimes(1)
			expect(newController.checkAssociation).not.toHaveBeenCalled()

			// Simulate a driver restart completing while the first
			// association's addAssociations call is still pending.
			driverPort.set(newDriver)
			deferred.resolve()

			const result = await resultPromise

			// The second iteration must re-resolve and observe the NEW
			// driver - never reuse the stale reference from before the
			// first iteration's await.
			expect(oldController.checkAssociation).toHaveBeenCalledTimes(1)
			expect(newController.checkAssociation).toHaveBeenCalledTimes(1)
			expect(oldController.addAssociations).toHaveBeenCalledTimes(1)
			expect(newController.addAssociations).toHaveBeenCalledTimes(1)
			expect(result).toEqual([
				AssociationCheckResult.OK,
				AssociationCheckResult.OK,
			])
		})
	})

	describe('removeAssociations', () => {
		it('removes associations and logs info', async () => {
			const { service, driver, log } = createService({
				2: { zwave: makeZWaveNode({ id: 2 }) },
			})

			await service.removeAssociations(source, 1, [association])

			expect(driver.controller.removeAssociations).toHaveBeenCalledWith(
				source,
				1,
				[association],
			)
			expect(log.calls).toContainEqual(
				expect.objectContaining({ level: 'info' }),
			)
		})

		it('logs a warning when the driver call throws', async () => {
			const { service, driver, log } = createService({
				2: { zwave: makeZWaveNode({ id: 2 }) },
			})
			driver.controller.removeAssociations = vi.fn(() => {
				throw new Error('remove failed')
			})

			await service.removeAssociations(source, 1, [association])

			expect(log.calls).toContainEqual(
				expect.objectContaining({
					level: 'warn',
					message: expect.stringContaining('remove failed'),
				}),
			)
		})

		it('logs a warning when the node or driver is missing', async () => {
			const { service, log } = createService({})

			await service.removeAssociations(source, 1, [association])

			expect(log.calls).toContainEqual(
				expect.objectContaining({
					level: 'warn',
					message: expect.stringContaining('node not found'),
				}),
			)
		})

		it('logs a warning (via the same catch path) when the node exists but the driver is not ready', async () => {
			const { service, log } = createService(
				{ 2: { zwave: makeZWaveNode({ id: 2 }) } },
				{},
				true,
			)

			await service.removeAssociations(source, 1, [association])

			expect(log.calls).toContainEqual(
				expect.objectContaining({
					level: 'warn',
					message: expect.stringContaining('Driver not ready'),
				}),
			)
		})
	})

	describe('removeAllAssociations', () => {
		it('removes every non-empty association group and logs the counts', async () => {
			const { service, driver, log } = createService({
				2: { zwave: makeZWaveNode({ id: 2 }) },
			})
			driver.controller.getAllAssociations = vi.fn(
				() =>
					new Map([
						[
							{ nodeId: 2, endpoint: undefined },
							new Map([
								[1, [{ nodeId: 3 }]],
								[2, []],
							]),
						],
					]),
			)

			await service.removeAllAssociations(2)

			expect(driver.controller.removeAssociations).toHaveBeenCalledTimes(
				1,
			)
			expect(driver.controller.removeAssociations).toHaveBeenCalledWith(
				{ nodeId: 2, endpoint: undefined },
				1,
				[{ nodeId: 3 }],
			)
			expect(log.calls).toContainEqual(
				expect.objectContaining({ level: 'info' }),
			)
		})

		it('logs a warning when an error is thrown mid-removal', async () => {
			const { service, driver, log } = createService({
				2: { zwave: makeZWaveNode({ id: 2 }) },
			})
			driver.controller.getAllAssociations = vi.fn(() => {
				throw new Error('enumerate failed')
			})

			await service.removeAllAssociations(2)

			expect(log.calls).toContainEqual(
				expect.objectContaining({
					level: 'warn',
					message: expect.stringContaining('enumerate failed'),
				}),
			)
		})

		it('logs a warning when the node or driver is missing', async () => {
			const { service, log } = createService({})

			await service.removeAllAssociations(99)

			expect(log.calls).toContainEqual(
				expect.objectContaining({
					level: 'warn',
					message: expect.stringContaining('Node not found'),
				}),
			)
		})

		it('logs a warning (via the same catch path) when the node exists but the driver is not ready', async () => {
			const { service, log } = createService(
				{ 2: { zwave: makeZWaveNode({ id: 2 }) } },
				{},
				true,
			)

			await service.removeAllAssociations(2)

			expect(log.calls).toContainEqual(
				expect.objectContaining({
					level: 'warn',
					message: expect.stringContaining('Driver not ready'),
				}),
			)
		})

		it('re-resolves the driver on every inner-loop iteration, observing a mid-flight restart (mutable port, deferred)', async () => {
			const deferred = createDeferred<void>()
			const oldController = {
				getAllAssociations: vi.fn(
					() =>
						new Map([
							[
								{ nodeId: 2, endpoint: undefined },
								new Map([
									[1, [{ nodeId: 3 }]],
									[2, [{ nodeId: 4 }]],
								]),
							],
						]),
				),
				removeAssociations: vi.fn(() => deferred.promise),
			}
			const newController = {
				getAllAssociations: vi.fn(() => new Map()),
				removeAssociations: vi.fn(() => Promise.resolve()),
			}
			const oldDriver = makeControllerDriver(oldController)
			const newDriver = makeControllerDriver(newController)
			const driverPort = createMutableDriverPort(oldDriver)

			const zwave = makeZWaveNode({ id: 2 })
			const nodeStore = createNodeStorePort({ 2: { zwave } })
			const log = createLogPort()
			const service = new AssociationService(driverPort, nodeStore, log)

			const resultPromise = service.removeAllAssociations(2)

			// The enumeration call and the first group's removal both hit
			// the OLD driver; the second group's removal is suspended on
			// the (deferred) promise.
			expect(oldController.getAllAssociations).toHaveBeenCalledTimes(1)
			expect(oldController.removeAssociations).toHaveBeenCalledTimes(1)
			expect(oldController.removeAssociations).toHaveBeenCalledWith(
				{ nodeId: 2, endpoint: undefined },
				1,
				[{ nodeId: 3 }],
			)

			// Simulate a driver restart completing while the first group's
			// removeAssociations call is still pending.
			driverPort.set(newDriver)
			deferred.resolve()

			await resultPromise

			// The second group's removal must re-resolve and observe the
			// NEW driver, never the stale reference from the enumeration
			// call or the first group's removal.
			expect(newController.removeAssociations).toHaveBeenCalledTimes(1)
			expect(newController.removeAssociations).toHaveBeenCalledWith(
				{ nodeId: 2, endpoint: undefined },
				2,
				[{ nodeId: 4 }],
			)
			expect(oldController.removeAssociations).toHaveBeenCalledTimes(1)
		})
	})

	describe('removeNodeFromAllAssociations', () => {
		it('calls driver.controller.removeNodeFromAllAssociations and logs info', async () => {
			const { service, driver, log } = createService({
				2: { zwave: makeZWaveNode({ id: 2 }) },
			})

			await service.removeNodeFromAllAssociations(2)

			expect(
				driver.controller.removeNodeFromAllAssociations,
			).toHaveBeenCalledWith(2)
			expect(log.calls).toContainEqual(
				expect.objectContaining({ level: 'info' }),
			)
		})

		it('logs a warning when the driver call throws', async () => {
			const { service, driver, log } = createService({
				2: { zwave: makeZWaveNode({ id: 2 }) },
			})
			driver.controller.removeNodeFromAllAssociations = vi.fn(() => {
				throw new Error('cannot remove')
			})

			await service.removeNodeFromAllAssociations(2)

			expect(log.calls).toContainEqual(
				expect.objectContaining({
					level: 'warn',
					message: expect.stringContaining('cannot remove'),
				}),
			)
		})

		it('logs a warning when the node or driver is missing', async () => {
			const { service, log } = createService({})

			await service.removeNodeFromAllAssociations(99)

			expect(log.calls).toContainEqual(
				expect.objectContaining({
					level: 'warn',
					message: expect.stringContaining('Node not found'),
				}),
			)
		})

		it('logs a warning (via the same catch path) when the node exists but the driver is not ready', async () => {
			const { service, log } = createService(
				{ 2: { zwave: makeZWaveNode({ id: 2 }) } },
				{},
				true,
			)

			await service.removeNodeFromAllAssociations(2)

			expect(log.calls).toContainEqual(
				expect.objectContaining({
					level: 'warn',
					message: expect.stringContaining('Driver not ready'),
				}),
			)
		})
	})
})
