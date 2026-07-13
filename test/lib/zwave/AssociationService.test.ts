import { describe, it, expect, vi } from 'vitest'
import { AssociationCheckResult, type AssociationAddress } from 'zwave-js'
import { ObjectKeyMap } from '@zwave-js/shared'
import { AssociationService } from '#api/lib/zwave/AssociationService'
import type {
	AssociationControllerHandle,
	AssociationDriverHandle,
	AssociationDriverPort,
	AssociationNodeStorePort,
	AssociationLogPort,
	AssociationNodeState,
	AssociationZWaveNodeHandle,
} from '#api/lib/zwave/ports'
import { createDeferred } from '../testUtils.ts'

function makeZWaveNode(
	overrides: Partial<{
		id: number
		refreshCCValues: () => Promise<void>
	}> = {},
): AssociationZWaveNodeHandle {
	return {
		refreshCCValues: vi.fn(
			overrides.refreshCCValues ?? (() => Promise.resolve()),
		),
	}
}

function createAssociationMap(
	entries: [
		AssociationAddress,
		ReadonlyMap<number, readonly AssociationAddress[]>,
	][] = [],
) {
	return new ObjectKeyMap<
		AssociationAddress,
		ReadonlyMap<number, readonly AssociationAddress[]>
	>(entries)
}

function createController(
	overrides: Partial<AssociationControllerHandle> = {},
): AssociationControllerHandle {
	return {
		getAllAssociationGroups: vi.fn(() => new Map()),
		getAllAssociations: vi.fn(() => createAssociationMap()),
		checkAssociation: vi.fn(() => AssociationCheckResult.OK),
		addAssociations: vi.fn(() => Promise.resolve()),
		removeAssociations: vi.fn(() => Promise.resolve()),
		removeNodeFromAllAssociations: vi.fn(() => Promise.resolve()),
		...overrides,
	}
}

function makeControllerDriver(
	controller: Partial<AssociationControllerHandle>,
): AssociationDriverHandle {
	return { controller: createController(controller) }
}

function createDriverPort(
	controllerOverrides: Partial<AssociationControllerHandle> = {},
	driverNull = false,
): AssociationDriverPort & { controller: AssociationControllerHandle } {
	const controller = createController(controllerOverrides)
	const driver: AssociationDriverHandle = { controller }
	return {
		getDriver: () => (driverNull ? null : driver),
		controller,
	}
}

function createNodeStorePort(
	nodes: Record<
		number,
		{ zwave?: AssociationZWaveNodeHandle; zui?: AssociationNodeState }
	>,
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
	nodes: Record<
		number,
		{ zwave?: AssociationZWaveNodeHandle; zui?: AssociationNodeState }
	>,
	driverOverrides: Parameters<typeof createDriverPort>[0] = {},
	driverNull = false,
) {
	const driver = createDriverPort(driverOverrides, driverNull)
	const nodeStore = createNodeStorePort(nodes)
	const log = createLogPort()
	const service = new AssociationService(driver, nodeStore, log)
	return { service, driver, nodeStore, log }
}

function createMutableDriverPort(
	initial: AssociationDriverHandle | null,
): AssociationDriverPort & {
	set: (driver: AssociationDriverHandle | null) => void
} {
	let current = initial
	return {
		getDriver: () => current,
		set: (driver: AssociationDriverHandle | null) => {
			current = driver
		},
	}
}

const source = { nodeId: 2 }
const association = { nodeId: 3 }

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

		it('clears projected groups and warns when the driver is unavailable', () => {
			const zui: AssociationNodeState = { id: 2 }
			const { service, nodeStore, log } = createService(
				{ 2: { zwave: makeZWaveNode({ id: 2 }), zui } },
				{},
				true,
			)

			service.getGroups(2)

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
			driver.controller.getAllAssociations = vi.fn(() =>
				createAssociationMap([
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

		it('uses the replacement driver after association refresh', async () => {
			const oldController = {
				getAllAssociations: vi.fn(() => createAssociationMap()),
			}
			const newController = {
				getAllAssociations: vi.fn(() =>
					createAssociationMap([
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

			expect(oldController.getAllAssociations).not.toHaveBeenCalled()
			expect(newController.getAllAssociations).not.toHaveBeenCalled()

			// Replace the driver before association refresh completes
			driverPort.set(newDriver)
			deferred.resolve()

			const result = await resultPromise

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
		it('returns the controller check result for the requested association', () => {
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

		it('throws when adding an association without a ready driver', async () => {
			const { service } = createService(
				{ 2: { zwave: makeZWaveNode({ id: 2 }) } },
				{},
				true,
			)

			await expect(
				service.addAssociations(source, 1, [association]),
			).rejects.toThrow('Driver not ready')
		})

		it('returns no results for an empty association list without a ready driver', async () => {
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

		it('logs a normal addition when a forced request already passes validation', async () => {
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

		it('uses the replacement driver for associations added after restart', async () => {
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

			expect(oldController.checkAssociation).toHaveBeenCalledTimes(1)
			expect(newController.checkAssociation).not.toHaveBeenCalled()

			// Replace the driver before the first association write completes
			driverPort.set(newDriver)
			deferred.resolve()

			const result = await resultPromise

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

		it('warns when the driver is unavailable', async () => {
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
		it('removes every non-empty association group', async () => {
			const { service, driver, log } = createService({
				2: { zwave: makeZWaveNode({ id: 2 }) },
			})
			driver.controller.getAllAssociations = vi.fn(() =>
				createAssociationMap([
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

		it('warns when the driver is unavailable', async () => {
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

		it('uses the replacement driver for removals after restart', async () => {
			const deferred = createDeferred<void>()
			const oldController = {
				getAllAssociations: vi.fn(() =>
					createAssociationMap([
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
				getAllAssociations: vi.fn(() => createAssociationMap()),
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

			// Enumerate and begin the first removal on the old driver
			expect(oldController.getAllAssociations).toHaveBeenCalledTimes(1)
			expect(oldController.removeAssociations).toHaveBeenCalledTimes(1)
			expect(oldController.removeAssociations).toHaveBeenCalledWith(
				{ nodeId: 2, endpoint: undefined },
				1,
				[{ nodeId: 3 }],
			)

			// Replace the driver before the first removal completes
			driverPort.set(newDriver)
			deferred.resolve()

			await resultPromise

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
		it('removes the node from every association and logs completion', async () => {
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

		it('warns when the driver is unavailable', async () => {
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
