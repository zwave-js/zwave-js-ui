import {
	CommandClasses,
	Duration,
	NODE_ID_BROADCAST,
	SecurityClass,
} from '@zwave-js/core'
import { RFRegion } from 'zwave-js'
import { describe, expect, it, vi } from 'vitest'

import type { ZUINode, ZUIValueId } from '#api/lib/ZwaveClient.ts'
import {
	NodeProjector,
	type PhysicalNodeProjectionPort,
} from '#api/lib/zwave/NodeProjector.ts'
import {
	createValue,
	createVirtualValue,
	createZWaveNode,
} from './nodeFixtures.ts'

describe('NodeProjector', () => {
	const binarySwitch = CommandClasses['Binary Switch']

	it('creates physical and virtual nodes with stable defaults', () => {
		expect(
			NodeProjector.newVirtualNode(
				NODE_ID_BROADCAST,
				'Broadcast',
				'broadcast',
			),
		).toMatchObject({
			id: NODE_ID_BROADCAST,
			name: 'Broadcast',
			virtual: true,
			kind: 'broadcast',
			ready: true,
			values: {},
		})
		expect(
			NodeProjector.createPhysicalNode(
				2,
				{
					name: 'Kitchen',
					loc: 'Downstairs',
					availableFirmwareUpdates: [
						{
							version: '2.0',
							normalizedVersion: '2.0',
							changelog: '',
							channel: 'stable',
							files: [],
							downgrade: false,
							device: {
								manufacturerId: 1,
								productType: 2,
								productId: 3,
								firmwareVersion: '1.0',
							},
						},
					],
					firmwareUpdatesDismissed: { '2.0': true },
					lastFirmwareUpdateCheck: 12,
					appliedTemplateContentHashes: ['hash'],
				},
				undefined,
				undefined,
			),
		).toMatchObject({
			id: 2,
			name: 'Kitchen',
			loc: 'Downstairs',
			status: 'Unknown',
			interviewStage: 'None',
			applicationRoute: null,
			lastFirmwareUpdateCheck: 12,
		})
		expect(
			NodeProjector.createPhysicalNode(
				3,
				undefined,
				undefined,
				undefined,
			),
		).toMatchObject({
			name: '',
			loc: '',
			availableFirmwareUpdates: [],
			firmwareUpdatesDismissed: {},
			lastFirmwareUpdateCheck: 0,
		})
	})

	it('uses metadata defaults in value identifiers and values', () => {
		expect(NodeProjector.getValueId(createValue())).toBe(
			`${binarySwitch}-0-currentValue`,
		)
		expect(
			NodeProjector.getValueId(
				createValue({ nodeId: 2, endpoint: 1, propertyKey: 4 }),
				true,
			),
		).toBe(`2-${binarySwitch}-1-currentValue-4`)
		expect(
			NodeProjector.buildVirtualValue(
				NODE_ID_BROADCAST,
				createVirtualValue(
					{
						type: 'string',
						readable: false,
						writeable: true,
						minLength: 1,
						maxLength: 10,
					},
					{ ccVersion: 0 },
				),
				'on',
				undefined,
				123,
			),
		).toMatchObject({
			id: `${NODE_ID_BROADCAST}-${binarySwitch}-0-currentValue`,
			readable: false,
			writeable: true,
			commandClassVersion: 1,
			value: 'on',
			lastUpdate: 123,
			minLength: 1,
			maxLength: 10,
		})
	})

	it('normalizes metadata for supported value types', () => {
		const numeric = NodeProjector.buildVirtualValue(
			2,
			createVirtualValue(
				{
					type: 'number',
					readable: true,
					writeable: false,
					min: 0,
					max: 10,
					steps: 2,
					unit: '%',
					states: { 0: 'Off', 10: 'On' },
					allowed: [{ from: 0, to: 10 }],
					destructive: true,
				},
				{ ccVersion: 5 },
			),
			5,
		)
		if (!numeric) throw new Error('Expected numeric projection')
		expect(numeric).toMatchObject({
			list: true,
			allowManualEntry: true,
			destructive: true,
			states: [
				{ text: 'Off', value: 0 },
				{ text: 'On', value: 10 },
			],
		})

		const explicitManual: ZUIValueId = { ...numeric, states: undefined }
		NodeProjector.applyValueMetadata(explicitManual, {
			type: 'number',
			readable: true,
			writeable: true,
			states: { 1: 'One' },
			allowManualEntry: false,
		})
		expect(explicitManual.allowManualEntry).toBe(false)

		const booleanValue: ZUIValueId = { ...numeric }
		NodeProjector.applyValueMetadata(booleanValue, {
			type: 'boolean',
			readable: true,
			writeable: true,
			states: { true: 'Yes', false: 'No' },
		})
		expect(booleanValue.states).toEqual([
			{ text: 'Yes', value: true },
			{ text: 'No', value: false },
		])
		NodeProjector.applyValueMetadata(booleanValue, {
			type: 'boolean',
			readable: true,
			writeable: true,
			states: {},
		})
		expect(booleanValue.list).toBe(false)

		NodeProjector.applyValueMetadata(booleanValue, {
			type: 'color',
			readable: true,
			writeable: true,
			minLength: 3,
			maxLength: 6,
		})
		expect(booleanValue).toMatchObject({
			minLength: 3,
			maxLength: 6,
			list: false,
		})
		NodeProjector.applyValueMetadata(booleanValue, {
			type: 'any',
			readable: true,
			writeable: true,
		})
		expect(booleanValue.list).toBe(false)
		NodeProjector.applyValueMetadata(booleanValue, {
			type: 'number',
			readable: true,
			writeable: true,
			states: {},
		})
		expect(booleanValue.list).toBe(false)
	})

	it('preserves publication settings when physical values change', () => {
		const node = createZWaveNode({
			getValue: vi.fn(() => undefined),
			getDefinedValueIDs: vi.fn(() => [
				createValue({
					property: 'targetValue',
					propertyName: 'targetValue',
				}),
			]),
		})
		const existing = NodeProjector.projectValue(
			node,
			createValue(),
			{
				type: 'number',
				readable: true,
				writeable: true,
			},
			undefined,
			2,
		)
		existing.toUpdate = true
		existing.conf = {
			device: 'switch',
			value: existing,
			enablePoll: true,
			pollInterval: 30,
		}
		const projected = NodeProjector.projectValue(
			node,
			createValue({ newValue: 7, stateless: true }),
			{
				type: 'number',
				readable: true,
				writeable: true,
				label: '',
			},
			existing,
			2,
		)
		expect(projected).toMatchObject({
			id: `2-${binarySwitch}-0-currentValue`,
			value: 7,
			stateless: true,
			isCurrentValue: true,
			targetValue: `${binarySwitch}-0-targetValue`,
			commandClassVersion: 4,
			conf: expect.objectContaining({
				enablePoll: true,
				pollInterval: 30,
			}),
		})

		const previous = NodeProjector.projectValue(
			node,
			createValue({ property: 'other', propertyName: 'other' }),
			{ type: 'number', readable: true, writeable: true },
			undefined,
			9,
		)
		expect(previous.value).toBe(9)

		const duration = NodeProjector.projectValue(
			node,
			createValue({ property: 'duration', propertyName: 'duration' }),
			{ type: 'duration', readable: true, writeable: true },
		)
		expect(duration.value).toBeInstanceOf(Duration)
	})

	it('resolves current values, targets, and notification updates', () => {
		expect(NodeProjector.isCurrentValue(createValue())).toBe(true)
		expect(
			NodeProjector.isCurrentValue(
				createValue({ propertyName: undefined }),
			),
		).toBe(false)
		expect(
			NodeProjector.findTargetValue(createValue(), [
				createValue({ endpoint: 1, property: 'targetValue' }),
				createValue({ property: 'targetValue' }),
			]),
		).toMatchObject({ property: 'targetValue' })
		expect(NodeProjector.getDeviceId(undefined)).toBe('')
		const identifiedNode = NodeProjector.createPhysicalNode(
			2,
			undefined,
			undefined,
			undefined,
		)
		identifiedNode.manufacturerId = 1
		identifiedNode.productId = 2
		identifiedNode.productType = 3
		expect(NodeProjector.getDeviceId(identifiedNode)).toBe('1-2-3')
		expect(NodeProjector.parseNotification(new Uint8Array([1, 2]))).toBe(
			'0102',
		)
		const duration = Reflect.construct(Duration, [2, 'seconds'])
		expect(NodeProjector.parseNotification(duration)).toBe(2000)
		expect(NodeProjector.parseNotification('unchanged')).toBe('unchanged')
	})

	it('serializes node events without runtime-only fields', () => {
		const node = createZWaveNode()
		const projectedNode = NodeProjector.createPhysicalNode(
			2,
			undefined,
			undefined,
			undefined,
		)
		Object.assign(projectedNode, {
			inited: true,
			manufacturer: 'Manufacturer',
			productDescription: 'Description',
			productLabel: 'Product',
			supportsLongRange: true,
		} satisfies Partial<ZUINode>)
		expect(
			NodeProjector.zwaveNodeToJSON(node, projectedNode),
		).toMatchObject({
			id: 2,
			inited: true,
			name: '',
			manufacturer: 'Manufacturer',
			productDescription: 'Description',
			productLabel: 'Product',
			supportsLongRange: true,
		})
	})

	it('includes physical node data and stored publication settings', () => {
		const node = NodeProjector.createPhysicalNode(
			2,
			undefined,
			undefined,
			undefined,
		)
		const zwaveNode = createZWaveNode()
		const storedNodes: Record<number, Partial<ZUINode>> = {
			2: {
				name: 'Kitchen',
				loc: 'Downstairs',
				hassDevices: {
					light: {
						type: 'light',
						object_id: 'kitchen_light',
						discovery_payload: {},
					},
				},
			},
		}
		const driver = {
			configManager: { lookupManufacturer: vi.fn(() => 'Looked up') },
			controller: {
				getSupportedRFRegions: vi.fn(() => [
					RFRegion.Unknown,
					RFRegion.USA,
					RFRegion['Default (EU)'],
				]),
			},
		}
		const port: PhysicalNodeProjectionPort = {
			getDriver: () => driver,
			getStoredNode: (nodeId) => storedNodes[nodeId],
			ensureStoredNode: (nodeId) => {
				storedNodes[nodeId] ??= {}
			},
			log: vi.fn(),
		}
		NodeProjector.projectPhysicalNode(node, zwaveNode, port)
		expect(node).toMatchObject({
			hexId: '0x0001 0x0003-0x0002',
			productLabel: 'Product',
			manufacturer: 'Manufacturer',
			name: 'Kitchen',
			loc: 'Downstairs',
			deviceId: '1-2-3',
			security: SecurityClass[SecurityClass.S2_Authenticated],
			lastActive: 1234,
			hasDeviceConfigChanged: true,
		})
		expect(node.endpoints).toEqual([
			expect.objectContaining({ index: 0, label: 'Root Endpoint' }),
			expect.objectContaining({ index: 1, label: 'Lamp' }),
		])
		expect(zwaveNode.name).toBe('Kitchen')
		expect(zwaveNode.location).toBe('Downstairs')

		const controller = NodeProjector.createPhysicalNode(
			1,
			undefined,
			undefined,
			undefined,
		)
		NodeProjector.projectPhysicalNode(
			controller,
			createZWaveNode({
				id: 1,
				isControllerNode: true,
				manufacturerId: undefined,
				productId: undefined,
				productType: undefined,
				deviceConfig: undefined,
				firmwareVersion: undefined,
				getHighestSecurityClass: vi.fn(() => undefined),
				lastSeen: undefined,
			}),
			port,
		)
		expect(controller.productLabel).toContain('Unknown product')
		expect(controller.manufacturer).toContain('Unknown manufacturer')
		expect(controller.rfRegions).toHaveLength(3)
		expect(storedNodes[1]).toEqual({})
	})
})
