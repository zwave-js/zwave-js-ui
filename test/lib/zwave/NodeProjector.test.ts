import type { ValueMetadata } from '@zwave-js/core'
import { Duration, SecurityClass } from '@zwave-js/core'
import type {
	Driver,
	TranslatedValueID,
	VirtualValueID,
	ZWaveNode,
} from 'zwave-js'
import { RFRegion } from 'zwave-js'
import { describe, expect, it, vi } from 'vitest'

import type { ZUINode, ZUIValueId } from '../../../api/lib/ZwaveClient.ts'
import {
	NodeProjector,
	type PhysicalNodeProjectionPort,
} from '../../../api/lib/zwave/NodeProjector.ts'

type ProjectorValue = TranslatedValueID & {
	nodeId?: number
	newValue?: unknown
	stateless?: boolean
}

function value(overrides: Partial<ProjectorValue> = {}): ProjectorValue {
	return {
		commandClass: 37,
		commandClassName: 'Binary Switch',
		endpoint: 0,
		property: 'currentValue',
		propertyName: 'currentValue',
		...overrides,
	}
}

function virtualValue(
	metadata: ValueMetadata,
	overrides: Partial<VirtualValueID> = {},
): VirtualValueID {
	return {
		...value(),
		metadata,
		ccVersion: 1,
		...overrides,
	}
}

function physicalNode(overrides: Partial<ZWaveNode> = {}): ZWaveNode {
	const node = {
		id: 2,
		name: '',
		location: '',
		status: 4,
		interviewStage: 7,
		isControllerNode: false,
		ready: true,
		isListening: true,
		isFrequentListening: false,
		canSleep: false,
		isRouting: true,
		supportedDataRates: [40000],
		maxDataRate: 40000,
		supportsSecurity: true,
		isSecure: true,
		supportsBeaming: true,
		protocolVersion: '7.19',
		sdkVersion: '7.19.0',
		firmwareVersion: '1.2',
		manufacturerId: 1,
		productId: 2,
		productType: 3,
		deviceDatabaseUrl: 'db',
		keepAwake: false,
		protocol: 0,
		zwavePlusVersion: 2,
		zwavePlusRoleType: 5,
		zwavePlusNodeType: 0,
		nodeType: 0,
		deviceClass: {
			basic: 1,
			generic: { key: 2 },
			specific: { key: 3 },
		},
		lastSeen: new Date(1234),
		defaultTransitionDuration: undefined,
		defaultVolume: 50,
		deviceConfig: {
			label: 'Product',
			description: 'Description',
			manufacturer: 'Manufacturer',
		},
		getEndpointCount: vi.fn(() => 2),
		getAllEndpoints: vi.fn(() => [
			{
				index: 0,
				endpointLabel: '',
				deviceClass: {
					basic: 1,
					generic: { key: 2 },
					specific: { key: 3 },
				},
			},
			{ index: 1, endpointLabel: 'Lamp', deviceClass: undefined },
		]),
		getHighestSecurityClass: vi.fn(() => SecurityClass.S2_Authenticated),
		getFirmwareUpdateCapabilitiesCached: vi.fn(() => ({
			firmwareUpgradable: true,
		})),
		hasDeviceConfigChanged: vi.fn(() => true),
		getValue: vi.fn(() => undefined),
		getDefinedValueIDs: vi.fn(() => []),
		getEndpoint: vi.fn(() => ({ getCCVersion: vi.fn(() => 4) })),
		getCCVersion: vi.fn(() => 3),
	}
	return Object.assign(node, overrides)
}

describe('NodeProjector', () => {
	it('constructs stable physical and virtual shells', () => {
		expect(
			NodeProjector.newVirtualNode(255, 'Broadcast', 'broadcast'),
		).toMatchObject({
			id: 255,
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
					availableFirmwareUpdates: [{ version: '2.0' }],
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

	it('builds identifiers and virtual values with metadata defaults', () => {
		expect(NodeProjector.getValueId(value())).toBe('37-0-currentValue')
		expect(
			NodeProjector.getValueId(
				value({ nodeId: 2, endpoint: 1, propertyKey: 4 }),
				true,
			),
		).toBe('2-37-1-currentValue-4')
		expect(
			NodeProjector.buildVirtualValue(
				255,
				virtualValue(
					{
						type: 'string',
						readable: undefined,
						writeable: undefined,
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
			id: '255-37-0-currentValue',
			readable: false,
			writeable: true,
			commandClassVersion: 1,
			value: 'on',
			lastUpdate: 123,
			minLength: 1,
			maxLength: 10,
		})
	})

	it('projects numeric, boolean, string, color, and fallback metadata', () => {
		const numeric = NodeProjector.buildVirtualValue(
			2,
			virtualValue(
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
			type: 'object',
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

	it('updates and projects physical values, preserving existing fields', () => {
		const node = physicalNode({
			getValue: vi.fn(() => undefined),
			getDefinedValueIDs: vi.fn(() => [
				value({ property: 'targetValue', propertyName: 'targetValue' }),
			]),
		})
		const existing = NodeProjector.projectValue(
			node,
			value(),
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
			value({ newValue: 7, stateless: true }),
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
			id: '2-37-0-currentValue',
			value: 7,
			stateless: true,
			isCurrentValue: true,
			targetValue: '37-0-targetValue',
			commandClassVersion: 4,
			conf: expect.objectContaining({
				enablePoll: true,
				pollInterval: 30,
			}),
		})

		const previous = NodeProjector.projectValue(
			node,
			value({ property: 'other', propertyName: 'other' }),
			{ type: 'number', readable: true, writeable: true },
			undefined,
			9,
		)
		expect(previous.value).toBe(9)

		const duration = NodeProjector.projectValue(
			node,
			value({ property: 'duration', propertyName: 'duration' }),
			{ type: 'duration', readable: true, writeable: true },
		)
		expect(duration.value).toBeInstanceOf(Duration)
	})

	it('finds targets, identifies current values, and projects notifications', () => {
		expect(NodeProjector.isCurrentValue(value())).toBe(true)
		expect(
			NodeProjector.isCurrentValue(value({ propertyName: undefined })),
		).toBe(false)
		expect(
			NodeProjector.findTargetValue(value(), [
				value({ endpoint: 1, property: 'targetValue' }),
				value({ property: 'targetValue' }),
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

	it('serializes the stable node event payload', () => {
		const node = physicalNode()
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

	it('projects full physical node data and stored publication settings', () => {
		const node = NodeProjector.createPhysicalNode(
			2,
			undefined,
			undefined,
			undefined,
		)
		const zwaveNode = physicalNode()
		const storedNodes: Record<number, Partial<ZUINode>> = {
			2: {
				name: 'Kitchen',
				loc: 'Downstairs',
				hassDevices: { light: { type: 'light' } },
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
		} as unknown as Driver
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
			physicalNode({
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
