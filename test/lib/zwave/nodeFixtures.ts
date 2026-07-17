import {
	BasicDeviceClass,
	CommandClasses,
	SecurityClass,
	type ValueMetadata,
} from '@zwave-js/core'
import { EventEmitter } from 'node:events'
import {
	InterviewStage,
	NodeStatus,
	NodeType,
	Protocols,
	ZWavePlusNodeType,
	ZWavePlusRoleType,
	type TranslatedValueID,
	type VirtualValueID,
	type ZWaveNode,
} from 'zwave-js'
import { vi, type Mocked } from 'vitest'

import type { ServiceLogger } from '#api/lib/zwave/ports.ts'

export type TestValue = TranslatedValueID & {
	nodeId?: number
	newValue?: unknown
	prevValue?: unknown
	stateless?: boolean
}

export function createValue(overrides: Partial<TestValue> = {}): TestValue {
	return {
		commandClass: CommandClasses['Binary Switch'],
		commandClassName: 'Binary Switch',
		endpoint: 0,
		property: 'currentValue',
		propertyName: 'currentValue',
		...overrides,
	}
}

export function createVirtualValue(
	metadata: ValueMetadata,
	overrides: Partial<VirtualValueID> = {},
): VirtualValueID {
	return {
		...createValue(),
		metadata,
		ccVersion: 1,
		...overrides,
	}
}

export function createZWaveNode(overrides: Partial<ZWaveNode> = {}): ZWaveNode {
	const node = Object.assign(new EventEmitter(), {
		id: 2,
		name: '',
		location: '',
		status: NodeStatus.Alive,
		interviewStage: InterviewStage.Complete,
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
		protocol: Protocols.ZWave,
		zwavePlusVersion: 2,
		zwavePlusRoleType: ZWavePlusRoleType.AlwaysOnSlave,
		zwavePlusNodeType: ZWavePlusNodeType.Node,
		nodeType: NodeType['End Node'],
		deviceClass: {
			basic: BasicDeviceClass['Routing End Node'],
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
		commandClasses: {
			'Schedule Entry Lock': { isSupported: vi.fn(() => false) },
		},
		getEndpointCount: vi.fn(() => 2),
		getAllEndpoints: vi.fn(() => [
			{
				index: 0,
				endpointLabel: '',
				deviceClass: {
					basic: BasicDeviceClass['Routing End Node'],
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
		getDefinedValueIDs: vi.fn(() => []),
		getValueMetadata: vi.fn(
			(): ValueMetadata => ({
				type: 'number',
				readable: true,
				writeable: true,
			}),
		),
		getValue: vi.fn(() => 1),
		getEndpoint: vi.fn(() => ({ getCCVersion: vi.fn(() => 4) })),
		getCCVersion: vi.fn(() => 3),
		supportsCC: vi.fn(() => false),
		dsk: undefined,
	})
	return Object.assign(node, overrides)
}

export function createServiceLogger(): Mocked<ServiceLogger> {
	return {
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	}
}
