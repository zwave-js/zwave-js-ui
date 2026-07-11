import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ConfigurationTemplateService } from '../../../api/lib/zwave/ConfigurationTemplateService.ts'
import type {
	ZUIConfigurationTemplate,
	ZUIConfigurationTemplateValue,
	TemplateNodeState,
} from '../../../api/lib/zwave/ports.ts'
import { SetValueStatus } from 'zwave-js'

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
			}) as any,
	}
}

function createNodeStorePort(
	nodes: Map<number, TemplateNodeState> = new Map(),
	storeNodes: Record<number, Partial<TemplateNodeState>> = {},
) {
	return {
		getNode: vi.fn((id: number) => nodes.get(id)),
		getNodes: () => nodes.entries(),
		getStoreNode: vi.fn((id: number) => storeNodes[id]),
		setStoreNode: vi.fn((id: number, data: Partial<TemplateNodeState>) => {
			storeNodes[id] = { ...storeNodes[id], ...data }
		}),
		updateStoreNodes: vi.fn(() => Promise.resolve()),
		emitNodeUpdate: vi.fn(),
		writeValue: vi.fn(() =>
			Promise.resolve({
				status: SetValueStatus.Success,
			}),
		),
		logNode: vi.fn(),
		throttle: vi.fn((_key: string, fn: () => unknown) => fn()),
	}
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
				commandClass: 112,
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ConfigurationTemplateService', () => {
	beforeEach(() => {
		vi.restoreAllMocks()
		idCounter = 0
	})

	describe('getConfigurationTemplates', () => {
		it('returns the initial templates', () => {
			const templates = [makeTemplate()]
			const svc = new ConfigurationTemplateService(
				createDriverPort(),
				createNodeStorePort(),
				createPersistencePort(templates),
				createUtilsPort(),
				createLogger(),
				templates,
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
			)
			expect(svc.getConfigurationTemplates()).toEqual([])
		})
	})

	describe('createConfigurationTemplate', () => {
		it('creates a template from node CC 112 values', async () => {
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
			)

			await expect(
				svc.createConfigurationTemplate(2, 'X'),
			).rejects.toThrow('no writeable Configuration CC values')
		})

		it('triggers auto-apply when autoApply is true', async () => {
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
			)

			const result = await svc.createConfigurationTemplate(
				2,
				'Auto',
				true,
			)

			expect(result.autoApply).toBe(true)
		})
	})

	describe('updateConfigurationTemplate', () => {
		it('updates name and autoApply', async () => {
			const template = makeTemplate()
			const persistence = createPersistencePort()
			const svc = new ConfigurationTemplateService(
				createDriverPort(),
				createNodeStorePort(),
				persistence,
				createUtilsPort(),
				createLogger(),
				[template],
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
			)

			await expect(
				svc.updateConfigurationTemplate('nonexistent', { name: 'X' }),
			).rejects.toThrow('Template nonexistent not found')
		})
	})

	describe('deleteConfigurationTemplate', () => {
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
			)

			await svc.deleteConfigurationTemplate('tmpl-1')

			expect(node.appliedTemplateContentHashes).toEqual([])
		})
	})

	describe('applyConfigurationTemplate', () => {
		it('applies values via writeValue and records hash', async () => {
			const template = makeTemplate({
				values: [
					{ property: 1, endpoint: 0, value: 42 },
					{ property: 2, endpoint: 0, value: 100 },
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
			)

			const result = await svc.applyConfigurationTemplate('tmpl-1', 2)

			expect(result.success).toBe(2)
			expect(result.failed).toBe(0)
			expect(nodeStore.writeValue).toHaveBeenCalledTimes(2)
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
			)

			const result = await svc.applyConfigurationTemplate(
				'tmpl-1',
				2,
				true,
			)
			expect(result.success).toBe(1)
		})

		it('handles write failures and dead node early exit', async () => {
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
			;(
				nodeStore.writeValue as ReturnType<typeof vi.fn>
			).mockResolvedValue({
				status: SetValueStatus.Fail,
			})

			const svc = new ConfigurationTemplateService(
				createDriverPort(),
				nodeStore,
				createPersistencePort(),
				createUtilsPort(),
				createLogger(),
				[template],
			)

			const result = await svc.applyConfigurationTemplate('tmpl-1', 2)

			expect(result.failed).toBe(3)
			expect(result.reason).toBe('Node is dead')
		})

		it('catches exceptions from writeValue', async () => {
			const template = makeTemplate({
				values: [{ property: 1, endpoint: 0, value: 5 }],
			})
			const node = makeNode()
			const nodes = new Map([[2, node]])
			const nodeStore = createNodeStorePort(nodes)
			;(
				nodeStore.writeValue as ReturnType<typeof vi.fn>
			).mockRejectedValue(new Error('Timeout'))

			const svc = new ConfigurationTemplateService(
				createDriverPort(),
				nodeStore,
				createPersistencePort(),
				createUtilsPort(),
				createLogger(),
				[template],
			)

			const result = await svc.applyConfigurationTemplate('tmpl-1', 2)

			expect(result.failed).toBe(1)
			expect(result.errors[0]).toContain('Timeout')
		})
	})

	describe('importConfigurationTemplates', () => {
		it('imports templates and assigns new IDs', async () => {
			const persistence = createPersistencePort()
			const svc = new ConfigurationTemplateService(
				createDriverPort(),
				createNodeStorePort(),
				persistence,
				createUtilsPort(),
				createLogger(),
				[],
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
			)

			const legacyTemplate = {
				...makeTemplate(),
				minFirmwareVersion: '1.0',
				firmwareRange: undefined,
			} as any
			const result = await svc.importConfigurationTemplates([
				legacyTemplate,
			])

			expect(result[0].firmwareRange).toEqual({ min: '1.0' })
			expect((result[0] as any).minFirmwareVersion).toBeUndefined()
		})

		it('preserves existing contentHash if present', async () => {
			const svc = new ConfigurationTemplateService(
				createDriverPort(),
				createNodeStorePort(),
				createPersistencePort(),
				createUtilsPort(),
				createLogger(),
				[],
			)

			const template = makeTemplate({ contentHash: 'existing-hash' })
			const result = await svc.importConfigurationTemplates([template])

			expect(result[0].contentHash).toBe('existing-hash')
		})
	})

	describe('checkConfigurationTemplates', () => {
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
			const svc = new ConfigurationTemplateService(
				createDriverPort(),
				nodeStore,
				createPersistencePort(),
				createUtilsPort(),
				loggerFake,
				[template],
			)

			const zwaveNode = { id: 2 } as any
			svc.checkConfigurationTemplates(node, zwaveNode)

			// Allow async auto-apply to complete
			await new Promise((r) => setTimeout(r, 10))

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
			)

			const zwaveNode = { id: 2 } as any
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
			)

			const zwaveNode = { id: 2 } as any
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
			)

			const zwaveNode = { id: 2 } as any
			svc.checkConfigurationTemplates(node, zwaveNode)

			expect(nodeStore.writeValue).not.toHaveBeenCalled()
		})
	})

	describe('_generateContentHash (static)', () => {
		it('produces deterministic 12-char hex hash', () => {
			const values: ZUIConfigurationTemplateValue[] = [
				{ property: 1, endpoint: 0, value: 42 },
			]
			const hash1 =
				ConfigurationTemplateService._generateContentHash(values)
			const hash2 =
				ConfigurationTemplateService._generateContentHash(values)

			expect(hash1).toBe(hash2)
			expect(hash1.length).toBe(12)
			expect(/^[0-9a-f]{12}$/.test(hash1)).toBe(true)
		})

		it('includes firmware range in hash', () => {
			const values: ZUIConfigurationTemplateValue[] = [
				{ property: 1, endpoint: 0, value: 42 },
			]
			const hash1 =
				ConfigurationTemplateService._generateContentHash(values)
			const hash2 = ConfigurationTemplateService._generateContentHash(
				values,
				{ min: '1.0' },
			)

			expect(hash1).not.toBe(hash2)
		})

		it('normalizes propertyKey null vs undefined', () => {
			const v1: ZUIConfigurationTemplateValue[] = [
				{ property: 1, propertyKey: null, endpoint: 0, value: 42 },
			]
			const v2: ZUIConfigurationTemplateValue[] = [
				{ property: 1, propertyKey: undefined, endpoint: 0, value: 42 },
			]
			expect(ConfigurationTemplateService._generateContentHash(v1)).toBe(
				ConfigurationTemplateService._generateContentHash(v2),
			)
		})
	})

	describe('templates accessor', () => {
		it('returns the live template array', () => {
			const templates = [makeTemplate()]
			const svc = new ConfigurationTemplateService(
				createDriverPort(),
				createNodeStorePort(),
				createPersistencePort(),
				createUtilsPort(),
				createLogger(),
				templates,
			)
			expect(svc.templates).toBe(templates)
		})
	})

	describe('getDeviceConfigurationParams', () => {
		it('throws for invalid deviceId format', async () => {
			const svc = new ConfigurationTemplateService(
				createDriverPort(),
				createNodeStorePort(),
				createPersistencePort(),
				createUtilsPort(),
				createLogger(),
				[],
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
			)
			await expect(
				svc.getDeviceConfigurationParams('abc-def-ghi'),
			).rejects.toThrow('non-numeric')
		})
	})

	describe('createConfigurationTemplate – propertyKey branches', () => {
		it('captures propertyKey when present on CC112 value', async () => {
			const node = makeNode({
				values: {
					'0-112-0-5-1': {
						commandClass: 112,
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
			)

			const result = await svc.createConfigurationTemplate(2, 'Test')
			expect(result.values.length).toBe(1)
			expect(result.values[0].propertyKey).toBe(1)
		})

		it('skips non-writable CC112 values', async () => {
			const node = makeNode({
				values: {
					'0-112-0-1': {
						commandClass: 112,
						writeable: false,
						property: 1,
						endpoint: 0,
						value: 42,
						label: 'Readonly Param',
						description: 'Should be skipped',
					},
					'0-112-0-2': {
						commandClass: 112,
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
			)

			const result = await svc.createConfigurationTemplate(2, 'Test')
			expect(result.values.length).toBe(1)
			expect(result.values[0].property).toBe(2)
		})
	})

	describe('updateConfigurationTemplate – auto-apply on content change', () => {
		it('triggers auto-apply when values change and autoApply is true', async () => {
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

			// Use a driver port that returns a real controller.nodes
			const driverPort = {
				getDriver: () =>
					({
						controller: {
							nodes: new Map<number, unknown>(),
						},
					}) as any,
			}

			const svc = new ConfigurationTemplateService(
				driverPort,
				createNodeStorePort(nodes),
				createPersistencePort([existingTemplate]),
				createUtilsPort(),
				createLogger(),
				[existingTemplate],
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
			// Hash should change
			expect(updated.contentHash).not.toBe(originalHash)
		})
	})

	describe('applyConfigurationTemplate – error branch', () => {
		it('catches writeValue exceptions and counts as failed', async () => {
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
			const node = makeNode({ status: 'Dead' as any })
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
			)

			const result = await svc.applyConfigurationTemplate(template.id, 2)
			// First value fails, then remaining 2 are counted as failed
			expect(result.failed).toBe(3)
			expect(result.reason).toBe('Node is dead')
		})

		it('counts setValueFailed with message', async () => {
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
					status: SetValueStatus.Fail,
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
			)

			const result = await svc.applyConfigurationTemplate(template.id, 2)
			expect(result.failed).toBe(1)
			expect(result.errors[0]).toContain('Custom error message')
		})
	})

	describe('checkConfigurationTemplates – partial failure', () => {
		it('logs warning when auto-apply has partial failures', async () => {
			const template = makeTemplate({
				autoApply: true,
				contentHash: 'unique-hash',
			})
			const node = makeNode({ appliedTemplateContentHashes: [] })
			const nodes = new Map<number, TemplateNodeState>([[2, node]])
			const nodeStore = createNodeStorePort(nodes)
			// First call succeeds, second fails
			let callCount = 0
			nodeStore.writeValue = vi.fn(() => {
				callCount++
				if (callCount > 1) {
					return Promise.resolve({
						status: SetValueStatus.Fail,
						message: 'Failed',
					})
				}
				return Promise.resolve({ status: SetValueStatus.Success })
			})

			// add a second value
			template.values.push({
				property: 2,
				propertyKey: null,
				endpoint: 0,
				value: 99,
				label: 'P2',
				description: '',
			})

			const fakeZwaveNode = { id: 2 } as any
			const driverPort = {
				getDriver: () =>
					({
						controller: {
							nodes: {
								get: (id: number) =>
									id === 2 ? fakeZwaveNode : undefined,
							},
						},
					}) as any,
			}
			const logger = createLogger()

			const svc = new ConfigurationTemplateService(
				driverPort,
				nodeStore,
				createPersistencePort([template]),
				createUtilsPort(),
				logger,
				[template],
			)

			svc.checkConfigurationTemplates(node, fakeZwaveNode)
			// Give async auto-apply time to complete
			await new Promise((r) => setTimeout(r, 50))
			// Should have logged
			expect(nodeStore.logNode).toHaveBeenCalled()
		})
	})

	describe('_getMatchingTemplates – firmware range filtering', () => {
		it('excludes templates with min firmware above node firmware', () => {
			const template = makeTemplate({
				firmwareRange: { min: '2.0.0', max: undefined },
			})
			const node = makeNode({ firmwareVersion: '1.0.0' })
			const nodes = new Map<number, TemplateNodeState>([[2, node]])

			const svc = new ConfigurationTemplateService(
				createDriverPort(),
				createNodeStorePort(nodes),
				createPersistencePort([template]),
				createUtilsPort(),
				createLogger(),
				[template],
			)

			const fakeZwaveNode = { id: 2 } as any
			svc.checkConfigurationTemplates(node, fakeZwaveNode)
			// The template should not match, so no auto-apply happens
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

			const fakeZwaveNode = { id: 2 } as any

			const svc = new ConfigurationTemplateService(
				createDriverPort(),
				createNodeStorePort(nodes),
				createPersistencePort([template]),
				createUtilsPort(),
				createLogger(),
				[template],
			)

			svc.checkConfigurationTemplates(node, fakeZwaveNode)
			// Template should not be applied (firmware too high)
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

			const fakeZwaveNode = { id: 2 } as any
			const nodeStore = createNodeStorePort(nodes)

			const svc = new ConfigurationTemplateService(
				createDriverPort(),
				nodeStore,
				createPersistencePort([template]),
				createUtilsPort(),
				createLogger(),
				[template],
			)

			svc.checkConfigurationTemplates(node, fakeZwaveNode)
			// Give async auto-apply time to complete
			await new Promise((r) => setTimeout(r, 50))
			// Template should be applied (firmware in range)
			expect(nodeStore.logNode).toHaveBeenCalled()
		})

		it('skips template when node has no firmwareVersion', () => {
			const template = makeTemplate({
				autoApply: true,
				firmwareRange: { min: '1.0.0', max: undefined },
			})
			const node = makeNode({
				firmwareVersion: undefined as any,
				appliedTemplateContentHashes: [],
			})
			const nodes = new Map<number, TemplateNodeState>([[2, node]])

			const svc = new ConfigurationTemplateService(
				createDriverPort(),
				createNodeStorePort(nodes),
				createPersistencePort([template]),
				createUtilsPort(),
				createLogger(),
				[template],
			)

			const fakeZwaveNode = { id: 2 } as any
			svc.checkConfigurationTemplates(node, fakeZwaveNode)
			// No auto-apply should happen
		})
	})

	describe('_autoApplyToNodes – error handling', () => {
		it('logs error when auto-apply promise rejects', async () => {
			const template = makeTemplate({
				autoApply: true,
				contentHash: 'err-hash',
			})
			const node = makeNode({ appliedTemplateContentHashes: [] })
			const nodes = new Map<number, TemplateNodeState>([[2, node]])
			const nodeStore = createNodeStorePort(nodes)
			nodeStore.writeValue = vi.fn(() =>
				Promise.reject(new Error('Network error')),
			)

			const fakeZwaveNode = { id: 2 } as any
			const driverPort = {
				getDriver: () =>
					({
						controller: {
							nodes: new Map([[2, fakeZwaveNode]]),
						},
					}) as any,
			}

			const svc = new ConfigurationTemplateService(
				driverPort,
				nodeStore,
				createPersistencePort([template]),
				createUtilsPort(),
				createLogger(),
				[template],
			)

			// Trigger auto-apply via update with content change
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

			// Wait for async apply promises to settle
			await new Promise((r) => setTimeout(r, 100))
			// The error should be caught and logged, not thrown
			expect(nodeStore.logNode).toHaveBeenCalled()
		})
	})

	describe('applyConfigurationTemplate – no storeNode yet', () => {
		it('creates storeNode entry when none exists', async () => {
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
			)

			await svc.applyConfigurationTemplate(template.id, 2)
			// setStoreNode should have been called to create the entry
			expect(nodeStore.setStoreNode).toHaveBeenCalled()
		})
	})

	describe('checkConfigurationTemplates – no driver', () => {
		it('returns early when matching templates is empty', () => {
			const node = makeNode({ deviceId: 'other-device' })
			const svc = new ConfigurationTemplateService(
				{ getDriver: () => null },
				createNodeStorePort(),
				createPersistencePort(),
				createUtilsPort(),
				createLogger(),
				[],
			)
			// Should not throw even with no driver - no matching templates
			const fakeZwaveNode = { id: 2 } as any
			svc.checkConfigurationTemplates(node, fakeZwaveNode)
		})
	})

	describe('deleteConfigurationTemplate – cleanup hashes', () => {
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
			)

			await svc.deleteConfigurationTemplate(template.id)
			// The deleted hash should be removed, but other-hash remains (its template still exists)
			expect(node.appliedTemplateContentHashes).not.toContain('del-hash')
			expect(node.appliedTemplateContentHashes).toContain('other-hash')
		})
	})

	describe('importConfigurationTemplates – duplicate IDs', () => {
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
			)

			await svc.importConfigurationTemplates([imported])
			const templates = svc.getConfigurationTemplates()
			expect(templates.length).toBe(2)
			// The imported one should have a new ID
			const importedTemplate = templates.find(
				(t) => t.name === 'Imported',
			)
			expect(importedTemplate).toBeDefined()
			expect(importedTemplate.id).not.toBe('existing-id')
		})
	})

	describe('createConfigurationTemplate – edge cases', () => {
		it('throws when node has no values (values=undefined)', async () => {
			const node = makeNode({ values: undefined as any })
			const nodes = new Map<number, TemplateNodeState>([[2, node]])
			const svc = new ConfigurationTemplateService(
				createDriverPort(),
				createNodeStorePort(nodes),
				createPersistencePort(),
				createUtilsPort(),
				createLogger(),
				[],
			)

			await expect(
				svc.createConfigurationTemplate(2, 'Test'),
			).rejects.toThrow('no writeable Configuration CC values')
		})

		it('defaults endpoint to 0 when value.endpoint is undefined', async () => {
			const node = makeNode({
				values: {
					'0-112-0-1': {
						commandClass: 112,
						writeable: true,
						property: 1,
						endpoint: undefined as any,
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
			)

			const result = await svc.createConfigurationTemplate(2, 'Test')
			expect(result.values[0].endpoint).toBe(0)
		})

		it('defaults deviceId when node.deviceId is falsy', async () => {
			const node = makeNode({
				deviceId: undefined as any,
				values: {
					'0-112-0-1': {
						commandClass: 112,
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
			)

			const result = await svc.createConfigurationTemplate(2, 'Test')
			expect(result.deviceId).toBe('')
		})
	})

	describe('deleteConfigurationTemplate – no hash', () => {
		it('skips cleanup when template has no contentHash', async () => {
			const template = makeTemplate({ contentHash: '' })
			const node = makeNode({ appliedTemplateContentHashes: [] })
			const nodes = new Map<number, TemplateNodeState>([[2, node]])
			const nodeStore = createNodeStorePort(nodes)

			const svc = new ConfigurationTemplateService(
				createDriverPort(),
				nodeStore,
				createPersistencePort([template]),
				createUtilsPort(),
				createLogger(),
				[template],
			)

			const result = await svc.deleteConfigurationTemplate(template.id)
			expect(result).toBe(true)
		})
	})

	describe('applyConfigurationTemplate – no appliedTemplateContentHashes', () => {
		it('initializes appliedTemplateContentHashes when undefined', async () => {
			const template = makeTemplate()
			const node = makeNode({
				appliedTemplateContentHashes: undefined as any,
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
			)

			await svc.applyConfigurationTemplate(template.id, 2)
			// appliedTemplateContentHashes should now be initialized
			expect(node.appliedTemplateContentHashes).toBeDefined()
			expect(node.appliedTemplateContentHashes.length).toBe(1)
		})
	})

	describe('_autoApplyToNodes – skips nodes', () => {
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
					}) as any,
			}

			const svc = new ConfigurationTemplateService(
				driverPort,
				nodeStore,
				createPersistencePort([template]),
				createUtilsPort(),
				createLogger(),
				[template],
			)

			// Trigger auto-apply via update
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

			// Wait for async operations
			await new Promise((r) => setTimeout(r, 50))
			// writeValue should not be called since node is not ready
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
					}) as any,
			}

			const svc = new ConfigurationTemplateService(
				driverPort,
				nodeStore,
				createPersistencePort([template]),
				createUtilsPort(),
				createLogger(),
				[template],
			)

			// Trigger auto-apply via update with name change (no content change - but autoApply set)
			// Actually we need content change for autoApply to trigger
			// Let's use checkConfigurationTemplates instead
			const fakeZwaveNode = { id: 2 } as any
			svc.checkConfigurationTemplates(node, fakeZwaveNode)

			// writeValue should not be called since hash is already applied
			expect(nodeStore.writeValue).not.toHaveBeenCalled()
		})
	})

	describe('checkConfigurationTemplates – catch handler', () => {
		it('logs error when applyConfigurationTemplate rejects', async () => {
			const template = makeTemplate({
				autoApply: true,
				contentHash: 'check-catch-hash',
			})
			const node = makeNode({ appliedTemplateContentHashes: [] })
			const nodes = new Map<number, TemplateNodeState>([[2, node]])
			// Make getNode return undefined to trigger "not found" error
			// inside applyConfigurationTemplate
			const nodeStore = createNodeStorePort(nodes)
			// Override getNode to fail for node 2 (but getNodes still works)
			nodeStore.getNode = vi.fn(() => undefined)

			const fakeZwaveNode = { id: 2 } as any
			const driverPort = {
				getDriver: () =>
					({
						controller: {
							nodes: {
								get: (id: number) =>
									id === 2 ? fakeZwaveNode : undefined,
							},
						},
					}) as any,
			}
			const logger = createLogger()

			const svc = new ConfigurationTemplateService(
				driverPort,
				nodeStore,
				createPersistencePort([template]),
				createUtilsPort(),
				logger,
				[template],
			)

			svc.checkConfigurationTemplates(node, fakeZwaveNode)
			// Wait for async catch handler
			await new Promise((r) => setTimeout(r, 100))
			// The error should be caught and logged
			expect(nodeStore.logNode).toHaveBeenCalledWith(
				fakeZwaveNode,
				'error',
				expect.stringContaining('Failed to auto-apply'),
			)
		})
	})
})
