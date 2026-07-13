import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { ConfigurationTemplateService } from '#api/lib/zwave/ConfigurationTemplateService'
import type {
	ZUIConfigurationTemplate,
	ZUIConfigurationTemplateValue,
	TemplateNodeState,
	TemplateNodeStorePort,
	TemplateDriverPort,
	TemplateConfigManagerPort,
} from '#api/lib/zwave/ports'
import type { ZWaveNode } from 'zwave-js'
import { CommandClasses } from '@zwave-js/core'
import { SetValueStatus } from 'zwave-js'
import { DeviceConfig, type ParamInformation } from '@zwave-js/config'
import { ObjectKeyMap } from '@zwave-js/shared'

// ---------------------------------------------------------------------------
// Helpers: minimal fakes for ports
// ---------------------------------------------------------------------------

let idCounter = 0

function createUtilsPort() {
	return {
		generateId: () => `test-id-${++idCounter}`,
	}
}

function createLogger() {
	return {
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	}
}

function createPersistencePort(initial: ZUIConfigurationTemplate[] = []) {
	const stored: ZUIConfigurationTemplate[][] = []
	return {
		get: () => initial,
		put: vi.fn((data: ZUIConfigurationTemplate[]) => {
			stored.push([...data])
			return Promise.resolve()
		}),
		stored,
	}
}

function createDriverPort() {
	return {
		getDriver: () =>
			({
				controller: {
					nodes: { get: vi.fn(() => undefined) },
				},
			}) as ReturnType<TemplateDriverPort['getDriver']>,
	}
}

function createNodeStorePort(
	nodes: Map<number, TemplateNodeState> = new Map(),
	storeNodes: Record<number, Partial<TemplateNodeState>> = {},
) {
	const writeValue: Mock<TemplateNodeStorePort['writeValue']> = vi
		.fn<TemplateNodeStorePort['writeValue']>()
		.mockResolvedValue({ status: SetValueStatus.Success })
	return {
		getNode: vi.fn((id: number) => nodes.get(id)),
		getNodes: () => nodes.entries(),
		getStoreNode: vi.fn((id: number) => storeNodes[id]),
		setStoreNode: vi.fn((id: number, data: Partial<TemplateNodeState>) => {
			storeNodes[id] = { ...storeNodes[id], ...data }
		}),
		updateStoreNodes: vi.fn(() => Promise.resolve()),
		emitNodeUpdate: vi.fn(),
		writeValue,
		logNode: vi.fn(),
		throttle: vi.fn((_key: string, fn: () => unknown) => fn()),
	} satisfies TemplateNodeStorePort
}

function makeNode(
	overrides: Partial<TemplateNodeState> = {},
): TemplateNodeState {
	return {
		id: 2,
		ready: true,
		deviceId: '0x0086-0x0002-0x0064',
		manufacturerId: 0x0086,
		productId: 0x0002,
		productType: 0x0064,
		manufacturer: 'ACME',
		productLabel: 'Widget',
		firmwareVersion: '1.5.0',
		values: {
			'0-112-0-1': {
				commandClass: CommandClasses.Configuration,
				writeable: true,
				property: 1,
				endpoint: 0,
				value: 42,
				label: 'Param 1',
				description: 'A param',
			},
		},
		appliedTemplateContentHashes: [],
		...overrides,
	}
}

function makeTemplate(
	overrides: Partial<ZUIConfigurationTemplate> = {},
): ZUIConfigurationTemplate {
	return {
		id: 'tmpl-1',
		name: 'Test Template',
		deviceId: '0x0086-0x0002-0x0064',
		values: [{ property: 1, endpoint: 0, value: 42 }],
		autoApply: false,
		contentHash: 'abc123',
		createdAt: '2024-01-01T00:00:00.000Z',
		updatedAt: '2024-01-01T00:00:00.000Z',
		...overrides,
	}
}

function createConfigManagerPort(
	overrides: Partial<TemplateConfigManagerPort> = {},
): TemplateConfigManagerPort {
	return {
		loadDeviceIndex: vi.fn(() => Promise.resolve()),
		lookupDevice: vi.fn(() => Promise.resolve(undefined)),
		...overrides,
	}
}

describe('ConfigurationTemplateService', () => {
	beforeEach(() => {
		vi.restoreAllMocks()
		idCounter = 0
	})

	describe('listing templates', () => {
		it('returns the initial templates', () => {
			const templates = [makeTemplate()]
			const svc = new ConfigurationTemplateService(
				createDriverPort(),
				createNodeStorePort(),
				createPersistencePort(templates),
				createUtilsPort(),
				createLogger(),
				templates,
				createConfigManagerPort(),
			)
			expect(svc.getConfigurationTemplates()).toEqual(templates)
		})

		it('returns empty array when none exist', () => {
			const svc = new ConfigurationTemplateService(
				createDriverPort(),
				createNodeStorePort(),
				createPersistencePort(),
				createUtilsPort(),
				createLogger(),
				[],
				createConfigManagerPort(),
			)
			expect(svc.getConfigurationTemplates()).toEqual([])
		})
	})

	describe('creating templates', () => {
		it('creates a template from node Configuration CC values', async () => {
			const node = makeNode()
			const nodes = new Map([[2, node]])
			const persistence = createPersistencePort()
			const svc = new ConfigurationTemplateService(
				createDriverPort(),
				createNodeStorePort(nodes),
				persistence,
				createUtilsPort(),
				createLogger(),
				[],
				createConfigManagerPort(),
			)

			const result = await svc.createConfigurationTemplate(
				2,
				'My Template',
			)

			expect(result.name).toBe('My Template')
			expect(result.deviceId).toBe('0x0086-0x0002-0x0064')
			expect(result.values.length).toBe(1)
			expect(result.contentHash).toBeTruthy()
			expect(persistence.put).toHaveBeenCalled()
		})

		it('creates a template with custom values', async () => {
			const node = makeNode()
			const nodes = new Map([[2, node]])
			const svc = new ConfigurationTemplateService(
				createDriverPort(),
				createNodeStorePort(nodes),
				createPersistencePort(),
				createUtilsPort(),
				createLogger(),
				[],
				createConfigManagerPort(),
			)

			const values: ZUIConfigurationTemplateValue[] = [
				{ property: 5, endpoint: 0, value: 100 },
			]
			const result = await svc.createConfigurationTemplate(
				2,
				'Custom',
				false,
				values,
			)

			expect(result.values).toEqual(values)
		})

		it('creates with firmware range', async () => {
			const node = makeNode()
			const nodes = new Map([[2, node]])
			const svc = new ConfigurationTemplateService(
				createDriverPort(),
				createNodeStorePort(nodes),
				createPersistencePort(),
				createUtilsPort(),
				createLogger(),
				[],
				createConfigManagerPort(),
			)

			const result = await svc.createConfigurationTemplate(
				2,
				'FW Range',
				false,
				[{ property: 1, endpoint: 0, value: 10 }],
				{ min: '1.0', max: '2.0' },
			)

			expect(result.firmwareRange).toEqual({ min: '1.0', max: '2.0' })
		})

		it('throws when node not found', async () => {
			const svc = new ConfigurationTemplateService(
				createDriverPort(),
				createNodeStorePort(),
				createPersistencePort(),
				createUtilsPort(),
				createLogger(),
				[],
				createConfigManagerPort(),
			)

			await expect(
				svc.createConfigurationTemplate(99, 'X'),
			).rejects.toThrow('Node 99 not found')
		})

		it('throws when node is not ready', async () => {
			const node = makeNode({ ready: false })
			const nodes = new Map([[2, node]])
			const svc = new ConfigurationTemplateService(
				createDriverPort(),
				createNodeStorePort(nodes),
				createPersistencePort(),
				createUtilsPort(),
				createLogger(),
				[],
				createConfigManagerPort(),
			)

			await expect(
				svc.createConfigurationTemplate(2, 'X'),
			).rejects.toThrow('Node 2 is not ready')
		})

		it('throws when no writeable Configuration CC values', async () => {
			const node = makeNode({ values: {} })
			const nodes = new Map([[2, node]])
			const svc = new ConfigurationTemplateService(
				createDriverPort(),
				createNodeStorePort(nodes),
				createPersistencePort(),
				createUtilsPort(),
				createLogger(),
				[],
				createConfigManagerPort(),
			)

			await expect(
				svc.createConfigurationTemplate(2, 'X'),
			).rejects.toThrow('no writeable Configuration CC values')
		})

		it('automatically applies a new template when enabled', async () => {
			const node = makeNode()
			const nodes = new Map([[2, node]])
			const nodeStore = createNodeStorePort(nodes)
			const svc = new ConfigurationTemplateService(
				createDriverPort(),
				nodeStore,
				createPersistencePort(),
				createUtilsPort(),
				createLogger(),
				[],
				createConfigManagerPort(),
			)

			const result = await svc.createConfigurationTemplate(
				2,
				'Auto',
				true,
			)

			expect(result.autoApply).toBe(true)
		})
	})

	describe('updating templates', () => {
		it('updates the name and automatic application setting', async () => {
			const template = makeTemplate()
			const persistence = createPersistencePort()
			const svc = new ConfigurationTemplateService(
				createDriverPort(),
				createNodeStorePort(),
				persistence,
				createUtilsPort(),
				createLogger(),
				[template],
				createConfigManagerPort(),
			)

			const result = await svc.updateConfigurationTemplate('tmpl-1', {
				name: 'Renamed',
				autoApply: true,
			})

			expect(result.name).toBe('Renamed')
			expect(result.autoApply).toBe(true)
			expect(persistence.put).toHaveBeenCalled()
		})

		it('recalculates content hash when values change', async () => {
			const template = makeTemplate()
			const oldHash = template.contentHash
			const svc = new ConfigurationTemplateService(
				createDriverPort(),
				createNodeStorePort(),
				createPersistencePort(),
				createUtilsPort(),
				createLogger(),
				[template],
				createConfigManagerPort(),
			)

			const result = await svc.updateConfigurationTemplate('tmpl-1', {
				values: [{ property: 99, endpoint: 0, value: 999 }],
			})

			expect(result.contentHash).not.toBe(oldHash)
		})

		it('recalculates content hash when firmware range changes', async () => {
			const template = makeTemplate()
			const oldHash = template.contentHash
			const svc = new ConfigurationTemplateService(
				createDriverPort(),
				createNodeStorePort(),
				createPersistencePort(),
				createUtilsPort(),
				createLogger(),
				[template],
				createConfigManagerPort(),
			)

			const result = await svc.updateConfigurationTemplate('tmpl-1', {
				firmwareRange: { min: '2.0' },
			})

			expect(result.contentHash).not.toBe(oldHash)
		})

		it('throws when template not found', async () => {
			const svc = new ConfigurationTemplateService(
				createDriverPort(),
				createNodeStorePort(),
				createPersistencePort(),
				createUtilsPort(),
				createLogger(),
				[],
				createConfigManagerPort(),
			)

			await expect(
				svc.updateConfigurationTemplate('nonexistent', { name: 'X' }),
			).rejects.toThrow('Template nonexistent not found')
		})
	})

	describe('deleting templates', () => {
		it('deletes a template and persists', async () => {
			const template = makeTemplate()
			const persistence = createPersistencePort()
			const svc = new ConfigurationTemplateService(
				createDriverPort(),
				createNodeStorePort(),
				persistence,
				createUtilsPort(),
				createLogger(),
				[template],
				createConfigManagerPort(),
			)

			const result = await svc.deleteConfigurationTemplate('tmpl-1')

			expect(result).toBe(true)
			expect(svc.getConfigurationTemplates()).toEqual([])
			expect(persistence.put).toHaveBeenCalled()
		})

		it('throws when template not found', async () => {
			const svc = new ConfigurationTemplateService(
				createDriverPort(),
				createNodeStorePort(),
				createPersistencePort(),
				createUtilsPort(),
				createLogger(),
				[],
				createConfigManagerPort(),
			)

			await expect(
				svc.deleteConfigurationTemplate('nonexistent'),
			).rejects.toThrow('Template nonexistent not found')
		})

		it('cleans up applied hashes from nodes', async () => {
			const template = makeTemplate({ contentHash: 'hash123' })
			const node = makeNode({ appliedTemplateContentHashes: ['hash123'] })
			const nodes = new Map([[2, node]])
			const nodeStore = createNodeStorePort(nodes)
			const svc = new ConfigurationTemplateService(
				createDriverPort(),
				nodeStore,
				createPersistencePort(),
				createUtilsPort(),
				createLogger(),
				[template],
				createConfigManagerPort(),
			)

			await svc.deleteConfigurationTemplate('tmpl-1')

			expect(node.appliedTemplateContentHashes).toEqual([])
		})
	})

	describe('applying templates', () => {
		it('writes template values and records the applied content hash', async () => {
			const template = makeTemplate({
				values: [
					{
						property: 1,
						propertyKey: null,
						endpoint: 0,
						value: 42,
					},
					{
						property: 2,
						propertyKey: 3,
						endpoint: 1,
						value: 100,
					},
				],
			})
			const node = makeNode()
			const nodes = new Map([[2, node]])
			const nodeStore = createNodeStorePort(nodes)
			const loggerFake = createLogger()
			const svc = new ConfigurationTemplateService(
				createDriverPort(),
				nodeStore,
				createPersistencePort(),
				createUtilsPort(),
				loggerFake,
				[template],
				createConfigManagerPort(),
			)

			const result = await svc.applyConfigurationTemplate('tmpl-1', 2)

			expect(result.success).toBe(2)
			expect(result.failed).toBe(0)
			expect(nodeStore.writeValue).toHaveBeenCalledTimes(2)

			expect(nodeStore.writeValue).toHaveBeenCalledWith(
				{
					nodeId: 2,
					commandClass: CommandClasses.Configuration,
					endpoint: 0,
					property: 1,
					propertyKey: null,
				},
				42,
			)
			expect(nodeStore.writeValue).toHaveBeenCalledWith(
				{
					nodeId: 2,
					commandClass: CommandClasses.Configuration,
					endpoint: 1,
					property: 2,
					propertyKey: 3,
				},
				100,
			)

			expect(node.appliedTemplateContentHashes).toContain('abc123')
			expect(loggerFake.info).toHaveBeenCalled()
		})

		it('skips undefined values', async () => {
			const template = makeTemplate({
				values: [{ property: 1, endpoint: 0, value: undefined }],
			})
			const node = makeNode()
			const nodes = new Map([[2, node]])
			const nodeStore = createNodeStorePort(nodes)
			const svc = new ConfigurationTemplateService(
				createDriverPort(),
				nodeStore,
				createPersistencePort(),
				createUtilsPort(),
				createLogger(),
				[template],
				createConfigManagerPort(),
			)

			const result = await svc.applyConfigurationTemplate('tmpl-1', 2)

			expect(result.success).toBe(1)
			expect(nodeStore.writeValue).not.toHaveBeenCalled()
		})

		it('throws when template not found', async () => {
			const svc = new ConfigurationTemplateService(
				createDriverPort(),
				createNodeStorePort(),
				createPersistencePort(),
				createUtilsPort(),
				createLogger(),
				[],
				createConfigManagerPort(),
			)

			await expect(
				svc.applyConfigurationTemplate('nonexistent', 2),
			).rejects.toThrow('Template nonexistent not found')
		})

		it('throws when node not found', async () => {
			const template = makeTemplate()
			const svc = new ConfigurationTemplateService(
				createDriverPort(),
				createNodeStorePort(),
				createPersistencePort(),
				createUtilsPort(),
				createLogger(),
				[template],
				createConfigManagerPort(),
			)

			await expect(
				svc.applyConfigurationTemplate('tmpl-1', 99),
			).rejects.toThrow('Node 99 not found')
		})

		it('throws when node not ready', async () => {
			const template = makeTemplate()
			const node = makeNode({ ready: false })
			const nodes = new Map([[2, node]])
			const svc = new ConfigurationTemplateService(
				createDriverPort(),
				createNodeStorePort(nodes),
				createPersistencePort(),
				createUtilsPort(),
				createLogger(),
				[template],
				createConfigManagerPort(),
			)

			await expect(
				svc.applyConfigurationTemplate('tmpl-1', 2),
			).rejects.toThrow('Node 2 is not ready')
		})

		it('throws on device mismatch without force', async () => {
			const template = makeTemplate({
				deviceId: '0x0001-0x0001-0x0001',
			})
			const node = makeNode({
				deviceId: '0x0086-0x0002-0x0064',
			})
			const nodes = new Map([[2, node]])
			const svc = new ConfigurationTemplateService(
				createDriverPort(),
				createNodeStorePort(nodes),
				createPersistencePort(),
				createUtilsPort(),
				createLogger(),
				[template],
				createConfigManagerPort(),
			)

			await expect(
				svc.applyConfigurationTemplate('tmpl-1', 2),
			).rejects.toThrow('does not match node device type')
		})

		it('allows device mismatch with force', async () => {
			const template = makeTemplate({
				deviceId: '0x0001-0x0001-0x0001',
				values: [{ property: 1, endpoint: 0, value: 5 }],
			})
			const node = makeNode({
				deviceId: '0x0086-0x0002-0x0064',
			})
			const nodes = new Map([[2, node]])
			const svc = new ConfigurationTemplateService(
				createDriverPort(),
				createNodeStorePort(nodes),
				createPersistencePort(),
				createUtilsPort(),
				createLogger(),
				[template],
				createConfigManagerPort(),
			)

			const result = await svc.applyConfigurationTemplate(
				'tmpl-1',
				2,
				true,
			)
			expect(result.success).toBe(1)
		})

		it('reports each failed value while continuing the application', async () => {
			const template = makeTemplate({
				values: [
					{
						property: 1,
						propertyKey: null,
						endpoint: 0,
						value: 1,
					},
					{
						property: 2,
						propertyKey: null,
						endpoint: 0,
						value: 2,
					},
					{
						property: 3,
						propertyKey: null,
						endpoint: 0,
						value: 3,
					},
				],
			})
			const node = makeNode()
			const nodes = new Map([[2, node]])
			const nodeStore = createNodeStorePort(nodes)
			let callIdx = 0
			nodeStore.writeValue = vi.fn(() => {
				callIdx++
				if (callIdx === 2) {
					return Promise.resolve({
						status: SetValueStatus.InvalidValue,
						message: 'Custom error message',
					})
				}
				return Promise.resolve({ status: SetValueStatus.Success })
			})

			const loggerFake = createLogger()
			const svc = new ConfigurationTemplateService(
				createDriverPort(),
				nodeStore,
				createPersistencePort(),
				createUtilsPort(),
				loggerFake,
				[template],
				createConfigManagerPort(),
			)

			const result = await svc.applyConfigurationTemplate('tmpl-1', 2)

			expect(result.success).toBe(2)
			expect(result.failed).toBe(1)
			expect(result.errors[0]).toContain('Custom error message')

			expect(nodeStore.writeValue).toHaveBeenCalledTimes(3)
			expect(nodeStore.writeValue).toHaveBeenCalledWith(
				{
					nodeId: 2,
					commandClass: CommandClasses.Configuration,
					endpoint: 0,
					property: 1,
					propertyKey: null,
				},
				1,
			)
			expect(nodeStore.writeValue).toHaveBeenCalledWith(
				{
					nodeId: 2,
					commandClass: CommandClasses.Configuration,
					endpoint: 0,
					property: 2,
					propertyKey: null,
				},
				2,
			)
			expect(nodeStore.writeValue).toHaveBeenCalledWith(
				{
					nodeId: 2,
					commandClass: CommandClasses.Configuration,
					endpoint: 0,
					property: 3,
					propertyKey: null,
				},
				3,
			)
		})

		it('stops after the node becomes dead and reports remaining values', async () => {
			const template = makeTemplate({
				values: [
					{ property: 1, endpoint: 0, value: 1 },
					{ property: 2, endpoint: 0, value: 2 },
					{ property: 3, endpoint: 0, value: 3 },
				],
			})
			const node = makeNode({ status: 'Dead' })
			const nodes = new Map([[2, node]])
			const nodeStore = createNodeStorePort(nodes)
			vi.mocked(nodeStore.writeValue).mockResolvedValue({
				status: SetValueStatus.Fail,
			})

			const svc = new ConfigurationTemplateService(
				createDriverPort(),
				nodeStore,
				createPersistencePort(),
				createUtilsPort(),
				createLogger(),
				[template],
				createConfigManagerPort(),
			)

			const result = await svc.applyConfigurationTemplate('tmpl-1', 2)

			expect(result.failed).toBe(3)
			expect(result.reason).toBe('Node is dead')
		})

		it('reports exceptions from value writes', async () => {
			const template = makeTemplate({
				values: [{ property: 1, endpoint: 0, value: 5 }],
			})
			const node = makeNode()
			const nodes = new Map([[2, node]])
			const nodeStore = createNodeStorePort(nodes)
			vi.mocked(nodeStore.writeValue).mockRejectedValue(
				new Error('Timeout'),
			)

			const svc = new ConfigurationTemplateService(
				createDriverPort(),
				nodeStore,
				createPersistencePort(),
				createUtilsPort(),
				createLogger(),
				[template],
				createConfigManagerPort(),
			)

			const result = await svc.applyConfigurationTemplate('tmpl-1', 2)

			expect(result.failed).toBe(1)
			expect(result.errors[0]).toContain('Timeout')
		})
	})

	describe('importing template collections', () => {
		it('imports templates and assigns new IDs', async () => {
			const persistence = createPersistencePort()
			const svc = new ConfigurationTemplateService(
				createDriverPort(),
				createNodeStorePort(),
				persistence,
				createUtilsPort(),
				createLogger(),
				[],
				createConfigManagerPort(),
			)

			const imported = [makeTemplate({ id: 'old-id', contentHash: '' })]
			const result = await svc.importConfigurationTemplates(imported)

			expect(result.length).toBe(1)
			expect(result[0].id).not.toBe('old-id')
			expect(result[0].contentHash).toBeTruthy()
			expect(persistence.put).toHaveBeenCalled()
		})

		it('migrates legacy minFirmwareVersion to firmwareRange', async () => {
			const svc = new ConfigurationTemplateService(
				createDriverPort(),
				createNodeStorePort(),
				createPersistencePort(),
				createUtilsPort(),
				createLogger(),
				[],
				createConfigManagerPort(),
			)

			const legacyTemplate: ZUIConfigurationTemplate & {
				minFirmwareVersion?: string
			} = {
				...makeTemplate(),
				minFirmwareVersion: '1.0',
				firmwareRange: undefined,
			}
			const result = await svc.importConfigurationTemplates([
				legacyTemplate,
			])

			expect(result[0].firmwareRange).toEqual({ min: '1.0' })
			expect(legacyTemplate.minFirmwareVersion).toBeUndefined()
		})

		it('preserves existing contentHash if present', async () => {
			const svc = new ConfigurationTemplateService(
				createDriverPort(),
				createNodeStorePort(),
				createPersistencePort(),
				createUtilsPort(),
				createLogger(),
				[],
				createConfigManagerPort(),
			)

			const template = makeTemplate({ contentHash: 'existing-hash' })
			const result = await svc.importConfigurationTemplates([template])

			expect(result[0].contentHash).toBe('existing-hash')
		})
	})

	describe('automatic application when nodes become ready', () => {
		it('auto-applies matching templates on node ready', async () => {
			const template = makeTemplate({
				autoApply: true,
				values: [{ property: 1, endpoint: 0, value: 42 }],
			})
			const node = makeNode({
				appliedTemplateContentHashes: [],
			})
			const nodes = new Map([[2, node]])
			const nodeStore = createNodeStorePort(nodes)
			const loggerFake = createLogger()
			let resolveWrite: (() => void) | undefined
			const valueWritten = new Promise<void>((resolve) => {
				resolveWrite = resolve
			})
			nodeStore.writeValue = vi.fn(() => {
				resolveWrite?.()
				return Promise.resolve({ status: SetValueStatus.Success })
			})
			const svc = new ConfigurationTemplateService(
				createDriverPort(),
				nodeStore,
				createPersistencePort(),
				createUtilsPort(),
				loggerFake,
				[template],
				createConfigManagerPort(),
			)

			const zwaveNode = { id: 2 } as ZWaveNode
			svc.checkConfigurationTemplates(node, zwaveNode)
			await valueWritten

			expect(nodeStore.writeValue).toHaveBeenCalled()
		})

		it('skips templates already applied (by content hash)', () => {
			const template = makeTemplate({
				autoApply: true,
				contentHash: 'already-applied',
			})
			const node = makeNode({
				appliedTemplateContentHashes: ['already-applied'],
			})
			const nodes = new Map([[2, node]])
			const nodeStore = createNodeStorePort(nodes)
			const svc = new ConfigurationTemplateService(
				createDriverPort(),
				nodeStore,
				createPersistencePort(),
				createUtilsPort(),
				createLogger(),
				[template],
				createConfigManagerPort(),
			)

			const zwaveNode = { id: 2 } as ZWaveNode
			svc.checkConfigurationTemplates(node, zwaveNode)

			expect(nodeStore.writeValue).not.toHaveBeenCalled()
		})

		it('skips non-matching device IDs', () => {
			const template = makeTemplate({
				autoApply: true,
				deviceId: 'different-device',
			})
			const node = makeNode()
			const nodes = new Map([[2, node]])
			const nodeStore = createNodeStorePort(nodes)
			const svc = new ConfigurationTemplateService(
				createDriverPort(),
				nodeStore,
				createPersistencePort(),
				createUtilsPort(),
				createLogger(),
				[template],
				createConfigManagerPort(),
			)

			const zwaveNode = { id: 2 } as ZWaveNode
			svc.checkConfigurationTemplates(node, zwaveNode)

			expect(nodeStore.writeValue).not.toHaveBeenCalled()
		})

		it('respects firmware range filtering', () => {
			const template = makeTemplate({
				autoApply: true,
				firmwareRange: { min: '2.0' },
			})
			const node = makeNode({ firmwareVersion: '1.5.0' })
			const nodes = new Map([[2, node]])
			const nodeStore = createNodeStorePort(nodes)
			const svc = new ConfigurationTemplateService(
				createDriverPort(),
				nodeStore,
				createPersistencePort(),
				createUtilsPort(),
				createLogger(),
				[template],
				createConfigManagerPort(),
			)

			const zwaveNode = { id: 2 } as ZWaveNode
			svc.checkConfigurationTemplates(node, zwaveNode)

			expect(nodeStore.writeValue).not.toHaveBeenCalled()
		})
	})

	describe('template content hashes', () => {
		it('produces deterministic content hash for identical values', async () => {
			const node = makeNode()
			const nodes = new Map([[2, node]])
			const svc = new ConfigurationTemplateService(
				createDriverPort(),
				createNodeStorePort(nodes),
				createPersistencePort(),
				createUtilsPort(),
				createLogger(),
				[],
				createConfigManagerPort(),
			)

			const result1 = await svc.createConfigurationTemplate(
				2,
				'Template A',
				false,
				[{ property: 1, endpoint: 0, value: 42 }],
			)
			const result2 = await svc.createConfigurationTemplate(
				2,
				'Template B',
				false,
				[{ property: 1, endpoint: 0, value: 42 }],
			)

			expect(result1.contentHash).toBeTruthy()
			expect(result1.contentHash).toBe(result2.contentHash)
		})

		it('firmware range affects persisted contentHash', async () => {
			const node = makeNode()
			const nodes = new Map([[2, node]])
			const svc = new ConfigurationTemplateService(
				createDriverPort(),
				createNodeStorePort(nodes),
				createPersistencePort(),
				createUtilsPort(),
				createLogger(),
				[],
				createConfigManagerPort(),
			)

			const values: ZUIConfigurationTemplateValue[] = [
				{ property: 1, endpoint: 0, value: 42 },
			]
			const withoutFw = await svc.createConfigurationTemplate(
				2,
				'No FW',
				false,
				values,
			)
			const withFw = await svc.createConfigurationTemplate(
				2,
				'With FW',
				false,
				values,
				{ min: '1.0' },
			)

			expect(withoutFw.contentHash).not.toBe(withFw.contentHash)
		})

		it('produces the same hash when a value bit mask is null or omitted', async () => {
			const node = makeNode()
			const nodes = new Map([[2, node]])
			const svc = new ConfigurationTemplateService(
				createDriverPort(),
				createNodeStorePort(nodes),
				createPersistencePort(),
				createUtilsPort(),
				createLogger(),
				[],
				createConfigManagerPort(),
			)

			const resultNull = await svc.createConfigurationTemplate(
				2,
				'Null Key',
				false,
				[{ property: 1, propertyKey: null, endpoint: 0, value: 42 }],
			)
			const resultUndefined = await svc.createConfigurationTemplate(
				2,
				'Undef Key',
				false,
				[
					{
						property: 1,
						propertyKey: undefined,
						endpoint: 0,
						value: 42,
					},
				],
			)

			expect(resultNull.contentHash).toBe(resultUndefined.contentHash)
		})
	})

	describe('loading device configuration parameters', () => {
		it('rejects a malformed device identifier', async () => {
			const svc = new ConfigurationTemplateService(
				createDriverPort(),
				createNodeStorePort(),
				createPersistencePort(),
				createUtilsPort(),
				createLogger(),
				[],
				createConfigManagerPort(),
			)
			await expect(
				svc.getDeviceConfigurationParams('invalid'),
			).rejects.toThrow('Invalid deviceId format')
		})

		it('throws for non-numeric components', async () => {
			const svc = new ConfigurationTemplateService(
				createDriverPort(),
				createNodeStorePort(),
				createPersistencePort(),
				createUtilsPort(),
				createLogger(),
				[],
				createConfigManagerPort(),
			)
			await expect(
				svc.getDeviceConfigurationParams('abc-def-ghi'),
			).rejects.toThrow('non-numeric')
		})

		it('maps configuration parameters for a device identifier', async () => {
			const mockParamInfo = new ObjectKeyMap<
				{ parameter: number; valueBitMask?: number },
				ParamInformation
			>()
			mockParamInfo.set(
				{ parameter: 2, valueBitMask: undefined },
				{
					parameterNumber: 2,
					valueBitMask: undefined,
					label: 'Wake After Power On',
					description: 'Wake duration',
					valueSize: 1,
					allowed: [],
					writeOnly: undefined,
					minValue: 0,
					maxValue: 255,
					defaultValue: 0,
					recommendedValue: undefined,
					unit: 'seconds',
					allowManualEntry: true,
					destructive: undefined,
					options: [],
					hidden: undefined,
					purpose: undefined,
				},
			)
			mockParamInfo.set(
				{ parameter: 5, valueBitMask: 1 },
				{
					parameterNumber: 5,
					valueBitMask: 1,
					label: 'Sensor Report',
					description: 'Bitmask param',
					valueSize: 1,
					allowed: [],
					readOnly: true,
					writeOnly: undefined,
					minValue: 0,
					maxValue: 3,
					defaultValue: 1,
					recommendedValue: undefined,
					unit: undefined,
					allowManualEntry: false,
					destructive: undefined,
					options: [
						{ label: 'Off', value: 0 },
						{ label: 'On', value: 1 },
					],
					hidden: undefined,
					purpose: undefined,
				},
			)

			const mockDevice = new DeviceConfig(
				'test.json',
				false,
				'ACME',
				134,
				'Widget',
				'Test device',
				[{ productType: 100, productId: 2 }],
				{ min: '0.0', max: '255.255' },
				false,
				undefined,
				undefined,
				undefined,
				mockParamInfo,
			)

			const loadDeviceIndex = vi.fn(() => Promise.resolve())
			const lookupDevice = vi.fn(() => Promise.resolve(mockDevice))
			const configMgr = createConfigManagerPort({
				loadDeviceIndex,
				lookupDevice,
			})

			const svc = new ConfigurationTemplateService(
				createDriverPort(),
				createNodeStorePort(),
				createPersistencePort(),
				createUtilsPort(),
				createLogger(),
				[],
				configMgr,
			)

			// Device IDs order product ID before product type, while ConfigManager expects product type first
			const result = await svc.getDeviceConfigurationParams('134-2-100')

			expect(loadDeviceIndex).toHaveBeenCalled()

			expect(lookupDevice).toHaveBeenCalledWith(134, 100, 2)

			expect(result.length).toBe(2)

			expect(result[0]).toEqual({
				id: '0-112-0-2',
				commandClass: CommandClasses.Configuration,
				property: 2,
				propertyKey: undefined,
				endpoint: 0,
				type: 'number',
				readable: true,
				writeable: true,
				label: 'Wake After Power On',
				description: 'Wake duration',
				min: 0,
				max: 255,
				default: 0,
				unit: 'seconds',
				list: false,
				allowManualEntry: true,
				states: [],
				newValue: 0,
			})

			expect(result[1]).toEqual({
				id: '0-112-0-5-1',
				commandClass: CommandClasses.Configuration,
				property: 5,
				propertyKey: 1,
				endpoint: 0,
				type: 'number',
				readable: true,
				writeable: false,
				label: 'Sensor Report',
				description: 'Bitmask param',
				min: 0,
				max: 3,
				default: 1,
				unit: undefined,
				list: true,
				allowManualEntry: false,
				states: [
					{ text: 'Off', value: 0 },
					{ text: 'On', value: 1 },
				],
				newValue: 1,
			})
		})

		it('returns no parameters when the device configuration has none', async () => {
			const svc = new ConfigurationTemplateService(
				createDriverPort(),
				createNodeStorePort(),
				createPersistencePort(),
				createUtilsPort(),
				createLogger(),
				[],
				createConfigManagerPort(),
			)

			const result = await svc.getDeviceConfigurationParams('134-2-100')
			expect(result).toEqual([])
		})
	})

	describe('configuration value selection', () => {
		it('preserves a value bit mask in the template', async () => {
			const node = makeNode({
				values: {
					'0-112-0-5-1': {
						commandClass: CommandClasses.Configuration,
						writeable: true,
						property: 5,
						propertyKey: 1,
						endpoint: 0,
						value: 10,
						label: 'Param 5 bit 1',
						description: 'A bitmask param',
					},
				},
			})
			const nodes = new Map<number, TemplateNodeState>([[2, node]])
			const svc = new ConfigurationTemplateService(
				createDriverPort(),
				createNodeStorePort(nodes),
				createPersistencePort(),
				createUtilsPort(),
				createLogger(),
				[],
				createConfigManagerPort(),
			)

			const result = await svc.createConfigurationTemplate(2, 'Test')
			expect(result.values.length).toBe(1)
			expect(result.values[0].propertyKey).toBe(1)
		})

		it('skips non-writable Configuration CC values', async () => {
			const node = makeNode({
				values: {
					'0-112-0-1': {
						commandClass: CommandClasses.Configuration,
						writeable: false,
						property: 1,
						endpoint: 0,
						value: 42,
						label: 'Readonly Param',
						description: 'Should be skipped',
					},
					'0-112-0-2': {
						commandClass: CommandClasses.Configuration,
						writeable: true,
						property: 2,
						endpoint: 0,
						value: 99,
						label: 'Writable Param',
						description: 'Should be included',
					},
				},
			})
			const nodes = new Map<number, TemplateNodeState>([[2, node]])
			const svc = new ConfigurationTemplateService(
				createDriverPort(),
				createNodeStorePort(nodes),
				createPersistencePort(),
				createUtilsPort(),
				createLogger(),
				[],
				createConfigManagerPort(),
			)

			const result = await svc.createConfigurationTemplate(2, 'Test')
			expect(result.values.length).toBe(1)
			expect(result.values[0].property).toBe(2)
		})
	})

	describe('automatic application after template updates', () => {
		it('automatically applies an enabled template after its values change', async () => {
			const existingTemplate = makeTemplate({
				autoApply: true,
				values: [
					{
						property: 1,
						propertyKey: null,
						endpoint: 0,
						value: 42,
						label: 'P1',
						description: '',
					},
				],
			})
			const originalHash = existingTemplate.contentHash

			const node = makeNode()
			const nodes = new Map<number, TemplateNodeState>([[2, node]])

			const driverPort = {
				getDriver: () =>
					({
						controller: {
							nodes: new Map<number, unknown>(),
						},
					}) as ReturnType<TemplateDriverPort['getDriver']>,
			}

			const svc = new ConfigurationTemplateService(
				driverPort,
				createNodeStorePort(nodes),
				createPersistencePort([existingTemplate]),
				createUtilsPort(),
				createLogger(),
				[existingTemplate],
				createConfigManagerPort(),
			)

			const updated = await svc.updateConfigurationTemplate(
				existingTemplate.id,
				{
					values: [
						{
							property: 1,
							propertyKey: null,
							endpoint: 0,
							value: 99,
							label: 'P1',
							description: '',
						},
					],
				},
			)
			expect(updated.contentHash).not.toBe(originalHash)
		})
	})

	describe('failed template writes', () => {
		it('reports rejected writes as failures', async () => {
			const template = makeTemplate({
				values: [
					{
						property: 1,
						propertyKey: null,
						endpoint: 0,
						value: 42,
						label: 'P1',
						description: '',
					},
				],
			})
			const node = makeNode()
			const nodes = new Map<number, TemplateNodeState>([[2, node]])
			const nodeStore = createNodeStorePort(nodes)
			nodeStore.writeValue = vi.fn(() =>
				Promise.reject(new Error('Write failed')),
			)

			const svc = new ConfigurationTemplateService(
				createDriverPort(),
				nodeStore,
				createPersistencePort([template]),
				createUtilsPort(),
				createLogger(),
				[template],
				createConfigManagerPort(),
			)

			const result = await svc.applyConfigurationTemplate(template.id, 2)
			expect(result.failed).toBe(1)
			expect(result.errors.length).toBe(1)
			expect(result.errors[0]).toContain('Write failed')
		})

		it('records remaining values as failed when node is dead', async () => {
			const template = makeTemplate({
				values: [
					{
						property: 1,
						propertyKey: null,
						endpoint: 0,
						value: 1,
						label: 'P1',
						description: '',
					},
					{
						property: 2,
						propertyKey: null,
						endpoint: 0,
						value: 2,
						label: 'P2',
						description: '',
					},
					{
						property: 3,
						propertyKey: null,
						endpoint: 0,
						value: 3,
						label: 'P3',
						description: '',
					},
				],
			})
			const node = makeNode({ status: 'Dead' })
			const nodes = new Map<number, TemplateNodeState>([[2, node]])
			const nodeStore = createNodeStorePort(nodes)
			nodeStore.writeValue = vi.fn(() =>
				Promise.resolve({
					status: SetValueStatus.Fail,
				}),
			)

			const svc = new ConfigurationTemplateService(
				createDriverPort(),
				nodeStore,
				createPersistencePort([template]),
				createUtilsPort(),
				createLogger(),
				[template],
				createConfigManagerPort(),
			)

			const result = await svc.applyConfigurationTemplate(template.id, 2)
			expect(result.failed).toBe(3)
			expect(result.reason).toBe('Node is dead')
		})

		it('includes the write failure message', async () => {
			const template = makeTemplate({
				values: [
					{
						property: 1,
						propertyKey: null,
						endpoint: 0,
						value: 42,
						label: 'P1',
						description: '',
					},
				],
			})
			const node = makeNode()
			const nodes = new Map<number, TemplateNodeState>([[2, node]])
			const nodeStore = createNodeStorePort(nodes)
			nodeStore.writeValue = vi.fn(() =>
				Promise.resolve({
					status: SetValueStatus.InvalidValue,
					message: 'Custom error message',
				}),
			)

			const svc = new ConfigurationTemplateService(
				createDriverPort(),
				nodeStore,
				createPersistencePort([template]),
				createUtilsPort(),
				createLogger(),
				[template],
				createConfigManagerPort(),
			)

			const result = await svc.applyConfigurationTemplate(template.id, 2)
			expect(result.failed).toBe(1)
			expect(result.errors[0]).toContain('Custom error message')
		})
	})

	describe('partial automatic application', () => {
		it('logs a warning with partial application totals', async () => {
			const template = makeTemplate({
				autoApply: true,
				contentHash: 'unique-hash',
			})
			const node = makeNode({ appliedTemplateContentHashes: [] })
			const nodes = new Map<number, TemplateNodeState>([[2, node]])
			const nodeStore = createNodeStorePort(nodes)
			let callCount = 0
			nodeStore.writeValue = vi.fn(() => {
				callCount++
				if (callCount > 1) {
					return Promise.resolve({
						status: SetValueStatus.InvalidValue,
						message: 'Failed',
					})
				}
				return Promise.resolve({ status: SetValueStatus.Success })
			})

			template.values.push({
				property: 2,
				propertyKey: null,
				endpoint: 0,
				value: 99,
				label: 'P2',
				description: '',
			})

			const fakeZwaveNode = { id: 2 } as ZWaveNode
			const driverPort = {
				getDriver: () =>
					({
						controller: {
							nodes: {
								get: (id: number) =>
									id === 2 ? fakeZwaveNode : undefined,
							},
						},
					}) as ReturnType<TemplateDriverPort['getDriver']>,
			}
			const logger = createLogger()
			let resolveWarning: (() => void) | undefined
			const warningLogged = new Promise<void>((resolve) => {
				resolveWarning = resolve
			})
			nodeStore.logNode = vi.fn((_node: ZWaveNode, level: string) => {
				if (level === 'warn') resolveWarning?.()
			})

			const svc = new ConfigurationTemplateService(
				driverPort,
				nodeStore,
				createPersistencePort([template]),
				createUtilsPort(),
				logger,
				[template],
				createConfigManagerPort(),
			)

			svc.checkConfigurationTemplates(node, fakeZwaveNode)
			await warningLogged

			expect(nodeStore.logNode).toHaveBeenCalledWith(
				fakeZwaveNode,
				'warn',
				expect.stringContaining('partially applied'),
			)
			const logCalls = vi.mocked(nodeStore.logNode).mock.calls
			const infoLogs = logCalls.filter((c: unknown[]) => c[1] === 'info')
			const warnLogs = logCalls.filter((c: unknown[]) => c[1] === 'warn')
			expect(infoLogs.length).toBeGreaterThanOrEqual(1)
			expect(warnLogs.length).toBe(1)
			expect(warnLogs[0][2]).toMatch(/1 OK, 1 failed/)
		})
	})

	describe('automatic application by firmware version', () => {
		it('excludes templates with min firmware above node firmware', () => {
			const template = makeTemplate({
				autoApply: true,
				firmwareRange: { min: '2.0.0', max: undefined },
			})
			const node = makeNode({
				firmwareVersion: '1.0.0',
				appliedTemplateContentHashes: [],
			})
			const nodes = new Map<number, TemplateNodeState>([[2, node]])
			const nodeStore = createNodeStorePort(nodes)

			const svc = new ConfigurationTemplateService(
				createDriverPort(),
				nodeStore,
				createPersistencePort([template]),
				createUtilsPort(),
				createLogger(),
				[template],
				createConfigManagerPort(),
			)

			const fakeZwaveNode = { id: 2 } as ZWaveNode
			svc.checkConfigurationTemplates(node, fakeZwaveNode)
			expect(nodeStore.writeValue).not.toHaveBeenCalled()
		})

		it('excludes templates with max firmware below node firmware', () => {
			const template = makeTemplate({
				autoApply: true,
				firmwareRange: { min: undefined, max: '1.0.0' },
			})
			const node = makeNode({
				firmwareVersion: '2.0.0',
				appliedTemplateContentHashes: [],
			})
			const nodes = new Map<number, TemplateNodeState>([[2, node]])
			const nodeStore = createNodeStorePort(nodes)

			const fakeZwaveNode = { id: 2 } as ZWaveNode

			const svc = new ConfigurationTemplateService(
				createDriverPort(),
				nodeStore,
				createPersistencePort([template]),
				createUtilsPort(),
				createLogger(),
				[template],
				createConfigManagerPort(),
			)

			svc.checkConfigurationTemplates(node, fakeZwaveNode)
			expect(nodeStore.writeValue).not.toHaveBeenCalled()
		})

		it('includes template when node firmware is within range', async () => {
			const template = makeTemplate({
				autoApply: true,
				contentHash: 'in-range-hash',
				firmwareRange: { min: '1.0.0', max: '3.0.0' },
			})
			const node = makeNode({
				firmwareVersion: '1.5.0',
				appliedTemplateContentHashes: [],
			})
			const nodes = new Map<number, TemplateNodeState>([[2, node]])

			const fakeZwaveNode = { id: 2 } as ZWaveNode
			const nodeStore = createNodeStorePort(nodes)
			let resolveWrite: (() => void) | undefined
			const valueWritten = new Promise<void>((resolve) => {
				resolveWrite = resolve
			})
			nodeStore.writeValue = vi.fn(() => {
				resolveWrite?.()
				return Promise.resolve({ status: SetValueStatus.Success })
			})

			const svc = new ConfigurationTemplateService(
				createDriverPort(),
				nodeStore,
				createPersistencePort([template]),
				createUtilsPort(),
				createLogger(),
				[template],
				createConfigManagerPort(),
			)

			svc.checkConfigurationTemplates(node, fakeZwaveNode)
			await valueWritten
			expect(nodeStore.logNode).toHaveBeenCalled()
		})

		it('skips ranged templates when node firmware is unknown', () => {
			const template = makeTemplate({
				autoApply: true,
				firmwareRange: { min: '1.0.0', max: undefined },
			})
			const node = makeNode({
				firmwareVersion: undefined,
				appliedTemplateContentHashes: [],
			})
			const nodes = new Map<number, TemplateNodeState>([[2, node]])
			const nodeStore = createNodeStorePort(nodes)

			const svc = new ConfigurationTemplateService(
				createDriverPort(),
				nodeStore,
				createPersistencePort([template]),
				createUtilsPort(),
				createLogger(),
				[template],
				createConfigManagerPort(),
			)

			const fakeZwaveNode = { id: 2 } as ZWaveNode
			svc.checkConfigurationTemplates(node, fakeZwaveNode)
			expect(nodeStore.writeValue).not.toHaveBeenCalled()
		})
	})

	describe('automatic application failures', () => {
		it('logs error when auto-apply rejects', async () => {
			const template = makeTemplate({
				autoApply: true,
				contentHash: 'err-hash',
			})
			const node = makeNode({ appliedTemplateContentHashes: [] })
			const nodes = new Map<number, TemplateNodeState>([[2, node]])
			const nodeStore = createNodeStorePort(nodes)
			nodeStore.getNode = vi.fn(() => undefined)

			const fakeZwaveNode = { id: 2 } as ZWaveNode
			const driverPort = {
				getDriver: () =>
					({
						controller: {
							nodes: new Map([[2, fakeZwaveNode]]),
						},
					}) as ReturnType<TemplateDriverPort['getDriver']>,
			}
			let resolveError: (() => void) | undefined
			const errorLogged = new Promise<void>((resolve) => {
				resolveError = resolve
			})
			nodeStore.logNode = vi.fn((_node: ZWaveNode, level: string) => {
				if (level === 'error') resolveError?.()
			})

			const svc = new ConfigurationTemplateService(
				driverPort,
				nodeStore,
				createPersistencePort([template]),
				createUtilsPort(),
				createLogger(),
				[template],
				createConfigManagerPort(),
			)

			await svc.updateConfigurationTemplate(template.id, {
				values: [
					{
						property: 1,
						propertyKey: null,
						endpoint: 0,
						value: 999,
						label: 'P1',
						description: '',
					},
				],
			})

			await errorLogged
			const logCalls = vi.mocked(nodeStore.logNode).mock.calls
			const errorLogs = logCalls.filter(
				(c: unknown[]) => c[1] === 'error',
			)
			expect(errorLogs.length).toBe(1)
			expect(errorLogs[0][2]).toMatch(/Failed to auto-apply/)
		})
	})

	describe('persisting the first template application', () => {
		it('persists the applied hash when no node record exists', async () => {
			const template = makeTemplate()
			const node = makeNode()
			const nodes = new Map<number, TemplateNodeState>([[2, node]])
			const storeNodes: Record<number, Partial<TemplateNodeState>> = {}
			const nodeStore = createNodeStorePort(nodes, storeNodes)

			const svc = new ConfigurationTemplateService(
				createDriverPort(),
				nodeStore,
				createPersistencePort([template]),
				createUtilsPort(),
				createLogger(),
				[template],
				createConfigManagerPort(),
			)

			await svc.applyConfigurationTemplate(template.id, 2)
			expect(nodeStore.setStoreNode).toHaveBeenCalled()
		})
	})

	describe('deleting applied templates', () => {
		it('removes the deleted hash from all nodes', async () => {
			const template = makeTemplate({ contentHash: 'del-hash' })
			const otherTemplate = makeTemplate({
				id: 'other-tmpl',
				contentHash: 'other-hash',
			})
			const node = makeNode({
				appliedTemplateContentHashes: ['del-hash', 'other-hash'],
			})
			const nodes = new Map<number, TemplateNodeState>([[2, node]])
			const storeNodes: Record<number, Partial<TemplateNodeState>> = {
				2: { appliedTemplateContentHashes: ['del-hash', 'other-hash'] },
			}
			const nodeStore = createNodeStorePort(nodes, storeNodes)

			const svc = new ConfigurationTemplateService(
				createDriverPort(),
				nodeStore,
				createPersistencePort([template, otherTemplate]),
				createUtilsPort(),
				createLogger(),
				[template, otherTemplate],
				createConfigManagerPort(),
			)

			await svc.deleteConfigurationTemplate(template.id)
			expect(node.appliedTemplateContentHashes).not.toContain('del-hash')
			expect(node.appliedTemplateContentHashes).toContain('other-hash')
		})
	})

	describe('importing templates', () => {
		it('generates new IDs for imported templates with existing IDs', async () => {
			const existing = makeTemplate({ id: 'existing-id' })
			const imported: ZUIConfigurationTemplate = {
				...makeTemplate({ id: 'existing-id' }),
				name: 'Imported',
			}

			const svc = new ConfigurationTemplateService(
				createDriverPort(),
				createNodeStorePort(),
				createPersistencePort([existing]),
				createUtilsPort(),
				createLogger(),
				[existing],
				createConfigManagerPort(),
			)

			await svc.importConfigurationTemplates([imported])
			const templates = svc.getConfigurationTemplates()
			expect(templates.length).toBe(2)
			const importedTemplate = templates.find(
				(t) => t.name === 'Imported',
			)
			if (!importedTemplate) {
				throw new Error('Expected the imported template')
			}
			expect(importedTemplate.id).not.toBe('existing-id')
		})
	})

	describe('creating templates from incomplete node data', () => {
		it('rejects a node without configuration values', async () => {
			const node = makeNode({ values: undefined })
			const nodes = new Map<number, TemplateNodeState>([[2, node]])
			const svc = new ConfigurationTemplateService(
				createDriverPort(),
				createNodeStorePort(nodes),
				createPersistencePort(),
				createUtilsPort(),
				createLogger(),
				[],
				createConfigManagerPort(),
			)

			await expect(
				svc.createConfigurationTemplate(2, 'Test'),
			).rejects.toThrow('no writeable Configuration CC values')
		})

		it('uses endpoint zero when a value omits its endpoint', async () => {
			const node = makeNode({
				values: {
					'0-112-0-1': {
						commandClass: CommandClasses.Configuration,
						writeable: true,
						property: 1,
						endpoint: undefined,
						value: 42,
						label: 'P1',
						description: 'A param',
					},
				},
			})
			const nodes = new Map<number, TemplateNodeState>([[2, node]])
			const svc = new ConfigurationTemplateService(
				createDriverPort(),
				createNodeStorePort(nodes),
				createPersistencePort(),
				createUtilsPort(),
				createLogger(),
				[],
				createConfigManagerPort(),
			)

			const result = await svc.createConfigurationTemplate(2, 'Test')
			expect(result.values[0].endpoint).toBe(0)
		})

		it('uses an empty device identifier when the node has none', async () => {
			const node = makeNode({
				deviceId: undefined,
				values: {
					'0-112-0-1': {
						commandClass: CommandClasses.Configuration,
						writeable: true,
						property: 1,
						endpoint: 0,
						value: 42,
						label: 'P1',
						description: 'A param',
					},
				},
			})
			const nodes = new Map<number, TemplateNodeState>([[2, node]])
			const svc = new ConfigurationTemplateService(
				createDriverPort(),
				createNodeStorePort(nodes),
				createPersistencePort(),
				createUtilsPort(),
				createLogger(),
				[],
				createConfigManagerPort(),
			)

			const result = await svc.createConfigurationTemplate(2, 'Test')
			expect(result.deviceId).toBe('')
		})
	})

	describe('recording the first applied content hash', () => {
		it('records the applied hash for a node without prior history', async () => {
			const template = makeTemplate()
			const node = makeNode({
				appliedTemplateContentHashes: undefined,
			})
			const nodes = new Map<number, TemplateNodeState>([[2, node]])
			const nodeStore = createNodeStorePort(nodes)

			const svc = new ConfigurationTemplateService(
				createDriverPort(),
				nodeStore,
				createPersistencePort([template]),
				createUtilsPort(),
				createLogger(),
				[template],
				createConfigManagerPort(),
			)

			await svc.applyConfigurationTemplate(template.id, 2)
			expect(node.appliedTemplateContentHashes).toHaveLength(1)
		})
	})

	describe('automatic application eligibility', () => {
		it('skips non-ready nodes', async () => {
			const template = makeTemplate({
				autoApply: true,
				contentHash: 'skip-hash',
			})
			const node = makeNode({
				ready: false,
				appliedTemplateContentHashes: [],
			})
			const nodes = new Map<number, TemplateNodeState>([[2, node]])
			const nodeStore = createNodeStorePort(nodes)

			const driverPort = {
				getDriver: () =>
					({
						controller: {
							nodes: new Map([[2, { id: 2 }]]),
						},
					}) as ReturnType<TemplateDriverPort['getDriver']>,
			}

			const svc = new ConfigurationTemplateService(
				driverPort,
				nodeStore,
				createPersistencePort([template]),
				createUtilsPort(),
				createLogger(),
				[template],
				createConfigManagerPort(),
			)

			await svc.updateConfigurationTemplate(template.id, {
				values: [
					{
						property: 1,
						propertyKey: null,
						endpoint: 0,
						value: 999,
						label: 'P1',
						description: '',
					},
				],
			})

			expect(nodeStore.writeValue).not.toHaveBeenCalled()
		})

		it('skips already-applied hashes', () => {
			const template = makeTemplate({
				autoApply: true,
				contentHash: 'already-applied',
			})
			const node = makeNode({
				appliedTemplateContentHashes: ['already-applied'],
			})
			const nodes = new Map<number, TemplateNodeState>([[2, node]])
			const nodeStore = createNodeStorePort(nodes)

			const driverPort = {
				getDriver: () =>
					({
						controller: {
							nodes: new Map([[2, { id: 2 }]]),
						},
					}) as ReturnType<TemplateDriverPort['getDriver']>,
			}

			const svc = new ConfigurationTemplateService(
				driverPort,
				nodeStore,
				createPersistencePort([template]),
				createUtilsPort(),
				createLogger(),
				[template],
				createConfigManagerPort(),
			)

			const fakeZwaveNode = { id: 2 } as ZWaveNode
			svc.checkConfigurationTemplates(node, fakeZwaveNode)

			expect(nodeStore.writeValue).not.toHaveBeenCalled()
		})
	})

	describe('rejected automatic application', () => {
		it('logs an error when automatic application rejects', async () => {
			const template = makeTemplate({
				autoApply: true,
				contentHash: 'check-catch-hash',
			})
			const node = makeNode({ appliedTemplateContentHashes: [] })
			const nodes = new Map<number, TemplateNodeState>([[2, node]])
			const nodeStore = createNodeStorePort(nodes)
			nodeStore.getNode = vi.fn(() => undefined)

			const fakeZwaveNode = { id: 2 } as ZWaveNode
			const driverPort = {
				getDriver: () =>
					({
						controller: {
							nodes: {
								get: (id: number) =>
									id === 2 ? fakeZwaveNode : undefined,
							},
						},
					}) as ReturnType<TemplateDriverPort['getDriver']>,
			}
			const logger = createLogger()
			let resolveError: (() => void) | undefined
			const errorLogged = new Promise<void>((resolve) => {
				resolveError = resolve
			})
			nodeStore.logNode = vi.fn((_node: ZWaveNode, level: string) => {
				if (level === 'error') resolveError?.()
			})

			const svc = new ConfigurationTemplateService(
				driverPort,
				nodeStore,
				createPersistencePort([template]),
				createUtilsPort(),
				logger,
				[template],
				createConfigManagerPort(),
			)

			svc.checkConfigurationTemplates(node, fakeZwaveNode)
			await errorLogged

			const logCalls = vi.mocked(nodeStore.logNode).mock.calls
			const errorLogs = logCalls.filter(
				(c: unknown[]) => c[1] === 'error',
			)
			expect(errorLogs.length).toBe(1)
			expect(errorLogs[0][2]).toMatch(/Failed to auto-apply/)
			expect(errorLogs[0][2]).toMatch(/Node 2 not found/)

			const infoLogs = logCalls.filter((c: unknown[]) => c[1] === 'info')
			expect(infoLogs.length).toBe(1)
			expect(infoLogs[0][2]).toMatch(/Auto-applying/)
		})
	})
})
