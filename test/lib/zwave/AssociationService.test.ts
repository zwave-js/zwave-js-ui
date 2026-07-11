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

		it('does nothing at all when the driver is not ready', () => {
			const zui: AssociationNodeState = { id: 2 }
			const { service } = createService(
				{ 2: { zwave: makeZWaveNode({ id: 2 }), zui } },
				{},
				true,
			)

			service.getGroups(2)

			expect(zui.groups).toBeUndefined()
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

		it('throws when the driver is not ready', async () => {
			const { service } = createService(
				{ 2: { zwave: makeZWaveNode({ id: 2 }) } },
				{},
				true,
			)

			await expect(
				service.addAssociations(source, 1, [association]),
			).rejects.toThrow('Node 2 not found')
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
	})
})
