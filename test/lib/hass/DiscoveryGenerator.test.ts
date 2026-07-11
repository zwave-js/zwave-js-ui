import { CommandClasses } from '@zwave-js/core'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type {
	DiscoveryGenerator as DiscoveryGeneratorType,
	DiscoveryGeneratorOptions,
} from '../../../api/hass/DiscoveryGenerator.ts'
import type {
	HassDeviceRegistryPort,
	HassLogger,
	HassMqttPort,
	HassNode,
	HassValue,
	HassZwavePort,
} from '../../../api/hass/ports.ts'
import type * as HassPortsModule from '../../../api/hass/ports.ts'
import type {
	HassDevice,
	HassDeviceCatalog,
	HassDeviceMap,
} from '../../../api/hass/types.ts'
import {
	cleanupTestEnv,
	ensureTestEnv,
	snapshotRepositoryStore,
	type RepositoryStoreArtifact,
} from './env.ts'

let DiscoveryGenerator: typeof DiscoveryGeneratorType
let isHassNode: typeof HassPortsModule.isHassNode
let repositoryStoreBefore: RepositoryStoreArtifact[]

beforeAll(async () => {
	repositoryStoreBefore = snapshotRepositoryStore()
	const isolatedStoreDir = ensureTestEnv()
	const [discoveryModule, portsModule, configModule] = await Promise.all([
		import('../../../api/hass/DiscoveryGenerator.ts'),
		import('../../../api/hass/ports.ts'),
		import('../../../api/config/app.ts'),
	])
	DiscoveryGenerator = discoveryModule.DiscoveryGenerator
	isHassNode = portsModule.isHassNode
	expect(configModule.storeDir).toBe(isolatedStoreDir)
})

afterAll(() => {
	cleanupTestEnv()
	vi.resetModules()
	expect(snapshotRepositoryStore()).toEqual(repositoryStoreBefore)
})

function value(overrides: Partial<HassValue> = {}): HassValue {
	return {
		id: '2-37-0-currentValue',
		nodeId: 2,
		commandClass: CommandClasses['Binary Switch'],
		endpoint: 0,
		property: 'currentValue',
		propertyName: 'currentValue',
		type: 'boolean',
		readable: true,
		writeable: false,
		default: false,
		stateless: false,
		ccSpecific: {},
		value: false,
		...overrides,
	}
}

function node(overrides: Partial<HassNode> = {}): HassNode {
	return {
		id: 2,
		ready: true,
		values: {},
		hassDevices: {},
		deviceId: '1-2-3',
		deviceClass: { generic: 0x10, specific: 1 },
		...overrides,
	}
}

function device(overrides: Partial<HassDevice> = {}): HassDevice {
	return {
		type: 'sensor',
		object_id: 'test',
		discovery_payload: {},
		values: ['37-0-currentValue'],
		...overrides,
	}
}

function setup(options: {
	config?: DiscoveryGeneratorOptions['config']
	disabled?: boolean
	nodes?: Map<number, unknown>
	catalog?: HassDeviceCatalog
	publishError?: unknown
}) {
	const published: Array<{
		topic: string
		payload: unknown
		options: unknown
		prefix: string | undefined
	}> = []
	const updates: Array<{
		nodeId: number
		devices: HassDeviceMap
		deleteDevice?: boolean
	}> = []
	const emitted: Array<{ nodeId: number; devices: HassDeviceMap }> = []
	const writes: HassValue[] = []
	const nodes = options.nodes ?? new Map<number, unknown>()
	const catalog = new Map(
		Object.entries(options.catalog ?? {}).map(([key, devices]) => [
			key,
			[...devices],
		]),
	)
	const discovered: Record<string, HassDevice> = {}

	const mqtt: HassMqttPort = {
		disabled: options.disabled ?? false,
		getTopic: (topic, set) => `prefix/${topic}${set ? '/set' : ''}`,
		getStatusTopic: () => 'prefix/_CLIENTS/ZWAVE_GATEWAY/status',
		publish: (topic, payload, publishOptions, prefix) => {
			if (options.publishError !== undefined) {
				throw options.publishError
			}
			published.push({
				topic,
				payload,
				options: publishOptions,
				prefix,
			})
		},
	}
	const zwave: HassZwavePort = {
		homeHex: '0x12345678',
		getNode: (nodeId) => nodes.get(nodeId),
		getNodes: () => nodes,
		updateDevice: (hassDevice, nodeId, deleteDevice) => {
			updates.push({
				nodeId,
				devices: { updated: hassDevice },
				deleteDevice,
			})
		},
		emitNodeUpdate: (nodeId, devices) => emitted.push({ nodeId, devices }),
		writeCoverStop: (hassValue) => {
			writes.push(hassValue)
			return Promise.resolve()
		},
	}
	const registry: HassDeviceRegistryPort = {
		get: (deviceId) => (deviceId ? [...(catalog.get(deviceId) ?? [])] : []),
		set: (deviceId, devices) => {
			if (deviceId) catalog.set(deviceId, devices)
		},
		snapshot: () => Object.fromEntries(catalog),
	}
	const logDebug = vi.fn()
	const logWarn = vi.fn()
	const logError = vi.fn()
	const log = vi.fn()
	const logger: HassLogger = {
		debug: logDebug,
		info: vi.fn(),
		warn: logWarn,
		error: logError,
		log,
	}
	const generator = new DiscoveryGenerator({
		config: {
			hassDiscovery: true,
			discoveryPrefix: 'homeassistant',
			entityTemplate: '%ln_%o',
			...options.config,
		},
		mqtt,
		zwave,
		topics: {
			nodeTopic: (hassNode) => `node/${hassNode.id}`,
			valueTopic: (_node, hassValue, returnObject) =>
				returnObject
					? {
							topic: `node/${hassValue.id}`,
							targetTopic: hassValue.targetValue
								? `node/${hassValue.targetValue}`
								: undefined,
						}
					: `node/${hassValue.id}`,
		},
		registry,
		state: { discovered },
		logger,
	})

	return {
		generator,
		published,
		updates,
		emitted,
		writes,
		discovered,
		logger,
		logDebug,
		logWarn,
		logError,
		log,
		catalog,
	}
}

describe('DiscoveryGenerator', () => {
	it('narrows runtime nodes without accepting malformed DTOs', () => {
		expect(isHassNode(null)).toBe(false)
		expect(
			isHassNode({
				id: 1,
				ready: true,
				values: {},
				hassDevices: {},
			}),
		).toBe(true)
		expect(isHassNode({ id: '1', values: {}, hassDevices: {} })).toBe(false)
		expect(isHassNode({ id: 1, values: null, hassDevices: {} })).toBe(false)
		expect(isHassNode({ id: 1, values: {}, hassDevices: null })).toBe(false)
	})

	it('owns rediscovery, disabling, removal, and facade state updates', () => {
		const hassNode = node({
			name: 'Switch',
			manufacturer: 'Test',
			productDescription: 'Wall',
			productLabel: 'Switch',
			firmwareVersion: '1.0.0',
			hassDevices: { old: device() },
			values: {
				'37-0-currentValue': value({ isCurrentValue: true }),
			},
		})
		const { generator, discovered, emitted, published } = setup({
			nodes: new Map([
				[2, hassNode],
				[3, { id: 3 }],
				[4, node({ id: 4, virtual: true })],
			]),
		})
		discovered['2-stale'] = device()
		discovered['9-keep'] = device()

		generator.rediscoverNode(3)
		generator.rediscoverNode(4)
		generator.rediscoverNode(2)
		expect(discovered['2-stale']).toBeUndefined()
		expect(discovered['9-keep']).toBeDefined()
		expect(Object.keys(hassNode.hassDevices)).toEqual(['switch_switch'])
		expect(hassNode.hassDevices.switch_switch).toEqual({
			type: 'switch',
			object_id: 'switch',
			discovery_payload: {
				payload_off: false,
				payload_on: true,
				value_template: '{{ value_json.value }}',
				command_topic: 'prefix/node/2-37-0-currentValue/set',
				state_topic: 'prefix/node/2-37-0-currentValue',
				availability: [
					{
						payload_available: 'true',
						payload_not_available: 'false',
						topic: 'prefix/node/2/status',
						value_template:
							"{{'true' if value_json.value else 'false'}}",
					},
					{
						topic: 'prefix/_CLIENTS/ZWAVE_GATEWAY/status',
						value_template:
							"{{'online' if value_json.value else 'offline'}}",
					},
					{
						payload_available: 'true',
						payload_not_available: 'false',
						topic: 'prefix/driver/status',
					},
				],
				availability_mode: 'all',
				device: {
					identifiers: ['zwavejs2mqtt_0x12345678_node2'],
					manufacturer: 'Test',
					model: 'Wall (Switch)',
					name: 'Switch',
					sw_version: '1.0.0',
				},
				name: 'Switch_switch',
				unique_id: 'zwavejs2mqtt_0x12345678_2-37-0-currentValue',
			},
			discoveryTopic: 'switch/Switch/switch/config',
			values: ['37-0-currentValue'],
			persistent: false,
			ignoreDiscovery: false,
		})
		expect(published).toEqual([
			{
				topic: 'switch/Switch/switch/config',
				payload: hassNode.hassDevices.switch_switch.discovery_payload,
				options: { qos: 0, retain: false },
				prefix: 'homeassistant',
			},
		])
		expect(emitted).toEqual([{ nodeId: 2, devices: hassNode.hassDevices }])

		generator.disableDiscovery(3)
		generator.disableDiscovery(2)
		expect(Object.values(hassNode.hassDevices)).toHaveLength(1)
		expect(
			Object.values(hassNode.hassDevices).every(
				(entry) => entry.ignoreDiscovery,
			),
		).toBe(true)
		expect(emitted).toHaveLength(2)

		generator.removeNode({ id: 9 })
		expect(discovered['9-keep']).toBeUndefined()
	})

	it('publishes raw discovery, preserves deletion options, and updates storage', () => {
		const { generator, published, updates, discovered } = setup({
			config: {
				payloadType: 2,
				retainedDiscovery: true,
				manualDiscovery: true,
			},
		})
		const hassDevice = device({
			discoveryTopic: 'sensor/node/test/config',
			discovery_payload: {
				state_topic: '{{ value_json.value }}',
				payload_on: true,
				payload_off: false,
			},
		})

		generator.publishDiscovery(hassDevice, 2)
		expect(published).toHaveLength(0)
		expect(hassDevice.discovery_payload.state_topic).toBe(
			"{{ value == 'true' }}",
		)
		expect(discovered['2-37-0-currentValue']).toBe(hassDevice)

		generator.publishDiscovery(hassDevice, 2, {
			deleteDevice: true,
			forceUpdate: true,
		})
		expect(published).toEqual([
			{
				topic: 'sensor/node/test/config',
				payload: '',
				options: { qos: 0, retain: true },
				prefix: 'homeassistant',
			},
		])
		expect(updates[0]).toMatchObject({ nodeId: 2, deleteDevice: true })
		expect(discovered['2-37-0-currentValue']).toBeUndefined()

		const rawWithoutBinaryPayloads = setup({
			config: { payloadType: 2 },
		})
		const rawDevice = device({
			discoveryTopic: 'sensor/node/raw/config',
			discovery_payload: {
				state_topic: '{{ value_json.value }}',
			},
		})
		rawWithoutBinaryPayloads.generator.publishDiscovery(rawDevice, 2)
		expect(rawDevice.discovery_payload.state_topic).toBe('{{ value }}')
	})

	it('swallows malformed publication errors and reports disabled discovery', () => {
		const disabled = setup({ disabled: true })
		disabled.generator.publishDiscovery(device(), 2)
		expect(disabled.logDebug).toHaveBeenCalled()

		const active = setup({})
		active.generator.publishDiscovery(
			device({ values: undefined, discoveryTopic: 'bad/config' }),
			2,
		)
		expect(active.log).toHaveBeenCalledWith(
			'error',
			expect.stringContaining('has no values'),
			expect.any(Object),
		)

		const stringError = setup({ publishError: 'publish failed' })
		stringError.generator.publishDiscovery(
			device({ discoveryTopic: 'bad/config' }),
			2,
		)
		expect(stringError.log).toHaveBeenCalledWith(
			'error',
			expect.stringContaining('publish failed'),
			expect.any(Object),
		)

		const circular: Record<string, unknown> = {}
		circular.circular = circular
		const circularError = setup({ publishError: circular })
		circularError.generator.publishDiscovery(
			device({ discoveryTopic: 'bad/config' }),
			2,
		)
		expect(circularError.log).toHaveBeenCalledWith(
			'error',
			expect.stringContaining('Unknown error'),
			expect.any(Object),
		)
	})

	it('rediscoverAll skips malformed nodes and republishes persistent devices', () => {
		const stored = device({
			discoveryTopic: 'sensor/node/stored/config',
			persistent: true,
		})
		const nodes = new Map<number, unknown>([
			[1, { id: 1 }],
			[
				2,
				node({
					hassDevices: {
						stored,
						incomplete: device({ discoveryTopic: undefined }),
					},
				}),
			],
		])
		const enabled = setup({ nodes })
		enabled.generator.rediscoverAll()
		expect(enabled.published).toHaveLength(1)

		const disabled = setup({
			nodes,
			config: { hassDiscovery: false },
		})
		disabled.generator.rediscoverAll()
		expect(disabled.published).toHaveLength(0)
	})

	it('maps HA modes and handles cover stop writes', async () => {
		const fan = value({
			id: '2-68-0-mode',
			commandClass: CommandClasses['Thermostat Fan Mode'],
			property: 'mode',
			type: 'number',
			list: true,
		})
		const mode = value({
			id: '2-64-0-mode',
			commandClass: CommandClasses['Thermostat Mode'],
			property: 'mode',
			type: 'number',
			list: true,
		})
		const cover = value({
			id: '2-38-0-targetValue',
			commandClass: CommandClasses['Multilevel Switch'],
			property: 'targetValue',
			type: 'number',
		})
		const { generator, discovered, writes } = setup({})
		discovered[fan.id] = device({ fan_mode_map: { auto: 0 } })
		discovered[mode.id] = device({ mode_map: { heat: 1 } })
		discovered[cover.id] = device({
			type: 'cover',
			discovery_payload: { payload_stop: 'HALT' },
		})

		expect(generator.transformPayload('auto', fan)).toBe(0)
		expect(generator.transformPayload('heat', mode)).toBe(1)
		expect(generator.transformPayload(1, mode)).toBe(1)
		expect(generator.transformPayload('unchanged', value())).toBe(
			'unchanged',
		)
		expect(generator.transformPayload('HALT', cover)).toBeNull()
		await vi.waitFor(() => expect(writes).toEqual([cover]))
	})

	it('updates climate topics only for active mapped modes', () => {
		const setpoint = value({
			id: '2-67-0-setpoint-1',
			commandClass: CommandClasses['Thermostat Setpoint'],
			property: 'setpoint',
			type: 'number',
		})
		const mode = value({
			id: '2-64-0-mode',
			commandClass: CommandClasses['Thermostat Mode'],
			property: 'mode',
			value: 1,
			type: 'number',
		})
		const climate = device({
			type: 'climate',
			discoveryTopic: 'climate/node/config',
			setpoint_topic: { 1: '67-0-setpoint-1' },
			mode_map: { off: 0, heat: 1 },
		})
		const hassNode = node({
			values: { '67-0-setpoint-1': setpoint },
		})
		const { generator, discovered, published } = setup({})
		discovered[mode.id] = climate

		generator.updateClimateDiscovery(mode, hassNode, false)
		expect(published).toHaveLength(0)
		generator.updateClimateDiscovery(mode, hassNode, true)
		expect(climate.discovery_payload.temperature_state_topic).toContain(
			setpoint.id,
		)
		expect(published).toHaveLength(1)

		mode.value = 0
		generator.updateClimateDiscovery(mode, hassNode, true)
		expect(published).toHaveLength(1)
	})

	it('generates discovery helpers and templates deterministically', () => {
		const json = setup({ config: { useLocationAsSuggestedArea: true } })
		const raw = setup({ config: { payloadType: 2 } })
		const hassNode = node({ name: 'Switch', loc: '  Kitchen  ' })
		const payload: Record<string, unknown> = {}

		expect(json.generator.getNodeName(hassNode)).toBe('  Kitchen  -Switch')
		expect(json.generator.getNodeName(hassNode, true)).toBe('Switch')
		expect(json.generator.getNodeName(node({ name: undefined }))).toBe(
			'nodeID_2',
		)
		expect(
			json.generator.getPriorityCCFirst({
				binary: value(),
				color: value({
					commandClass: CommandClasses['Color Switch'],
				}),
			}),
		).toEqual(['color', 'binary'])
		expect(json.generator.getIdWithoutNode(value())).toBe(
			'37-0-currentValue',
		)
		expect(
			json.generator.deviceInfo(hassNode, 'Kitchen Switch'),
		).toMatchObject({
			identifiers: ['zwavejs2mqtt_0x12345678_node2'],
			name: 'Kitchen Switch',
			suggested_area: 'Kitchen',
		})

		json.generator.setDiscoveryAvailability(hassNode, payload)
		expect(payload.availability_mode).toBe('all')
		expect(payload.availability).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					value_template:
						"{{'true' if value_json.value else 'false'}}",
				}),
			]),
		)
		const rawPayload: Record<string, unknown> = {}
		raw.generator.setDiscoveryAvailability(hassNode, rawPayload)
		expect(rawPayload).toEqual({
			availability: [
				{
					payload_available: 'true',
					payload_not_available: 'false',
					topic: 'prefix/node/2/status',
				},
				{
					topic: 'prefix/_CLIENTS/ZWAVE_GATEWAY/status',
					value_template:
						"{{'online' if value_json.value else 'offline'}}",
				},
				{
					payload_available: 'true',
					payload_not_available: 'false',
					topic: 'prefix/driver/status',
				},
			],
			availability_mode: 'all',
		})

		expect(
			json.generator.getDiscoveryTopic(
				device({ type: 'switch', object_id: 'value' }),
				'Kitchen Switch',
			),
		).toBe('switch/Kitchen_Switch/value/config')
		expect(
			json.generator.getMappedValuesTemplate(
				{ 0: 'off', 1: 'heat' },
				'off',
			),
		).toContain('0: "off"')
		expect(
			json.generator.getMappedValuesInverseTemplate(
				{ off: 0, heat: 1 },
				'off',
			),
		).toContain('1: "heat"')
		expect(
			json.generator.getMappedStateTemplate(
				[
					{ value: 0, text: 'idle' },
					{ value: 'alarm', text: 'alarm' },
				],
				0,
			),
		).toContain("default('idle')")
	})

	it('generates binary payloads, names, and value substitutions', () => {
		const { generator } = setup({})
		const config = device()
		expect(
			generator.setBinaryPayloadFromSensor(
				config,
				[
					{ value: 1, text: 'on' },
					{ value: 0, text: 'off' },
				],
				0,
			).discovery_payload,
		).toMatchObject({ payload_on: 1, payload_off: 0 })
		expect(
			generator.getBinarySensorConfig('lock', true).discovery_payload,
		).toMatchObject({
			device_class: 'lock',
			payload_on: false,
			payload_off: true,
		})

		const payload: Record<string, unknown> = { min: 'setpoint' }
		generator.setDiscoveryValue(payload, 'min', {
			values: { setpoint: { value: 5 } },
		})
		generator.setDiscoveryValue(payload, 'missing', { values: {} })
		expect(payload.min).toBe(5)

		expect(
			generator.getEntityName(
				node({ id: 5, name: 'Node', loc: 'Room' }),
				value({
					property: 'current',
					propertyName: 'Current',
					propertyKey: 1,
					label: 'Level',
				}),
				device({ object_id: 'entity' }),
				'%nid_%ln_%loc_%pk_%pn_%p_%o_%n_%l',
			),
		).toBe('nodeID_5_Room-Node_Room_1_Current_current_entity_Node_Level')
		expect(
			generator.getEntityName(
				node({ id: 5 }),
				value({
					propertyKey: undefined,
					propertyName: undefined,
					label: undefined,
				}),
				device(),
				'%pk_%pn_%l',
			),
		).toBe('undefined_undefined_undefined')
	})

	it('discovers a complete custom climate device and malformed alternatives', () => {
		const mode = value({
			id: '2-64-0-mode',
			commandClass: CommandClasses['Thermostat Mode'],
			property: 'mode',
			type: 'number',
			value: 1,
		})
		const setpoint = value({
			id: '2-67-0-setpoint-1',
			commandClass: CommandClasses['Thermostat Setpoint'],
			property: 'setpoint',
			type: 'number',
			value: 21,
		})
		const fan = value({
			id: '2-68-0-mode',
			commandClass: CommandClasses['Thermostat Fan Mode'],
			property: 'mode',
			type: 'number',
		})
		const action = value({
			id: '2-66-0-state',
			commandClass: CommandClasses['Thermostat Operating State'],
			property: 'state',
			type: 'number',
		})
		const temperature = value({
			id: '2-49-0-Air temperature',
			commandClass: CommandClasses['Multilevel Sensor'],
			property: 'Air temperature',
			type: 'number',
			unit: '°F',
		})
		const hassNode = node({
			values: {
				mode,
				setpoint,
				fan,
				action,
				temperature,
				min: value({ value: 5 }),
				max: value({ value: 30 }),
			},
		})
		const climate = device({
			type: 'climate',
			object_id: 'thermostat',
			values: ['mode', 'setpoint', 'fan', 'action', 'temperature'],
			default_setpoint: 'setpoint',
			setpoint_topic: { 1: 'setpoint' },
			mode_map: { off: 0, heat: 1 },
			fan_mode_map: { auto: 0 },
			action_map: { 0: 'idle', 1: 'heating' },
			discovery_payload: {
				mode_state_topic: 'mode',
				fan_mode_state_topic: 'fan',
				action_topic: 'action',
				current_temperature_topic: 'temperature',
				min_temp: 'min',
				max_temp: 'max',
			},
		})
		const { generator, published, logError } = setup({})
		generator.discoverDevice(hassNode, climate)
		expect(published).toHaveLength(1)
		const payload = published[0].payload
		expect(payload).toMatchObject({
			temperature_unit: 'F',
			precision: 0.1,
			min_temp: 5,
			max_temp: 30,
		})

		const disabled = setup({ disabled: true })
		disabled.generator.discoverDevice(hassNode, climate)
		expect(disabled.published).toHaveLength(0)

		generator.discoverDevice(
			node(),
			device({
				type: 'climate',
				object_id: 'missing',
				default_setpoint: 'missing',
			}),
		)
		generator.discoverDevice(
			node(),
			device({ object_id: 'malformed', values: undefined }),
		)
		expect(logError).toHaveBeenCalledTimes(2)

		const genericNode = node({
			values: { value: value({ id: '2-value' }) },
		})
		generator.discoverDevice(
			genericNode,
			device({
				object_id: 'generic',
				values: ['missing', 'value'],
				discovery_payload: {
					state_topic: 'value',
					command_topic: 'value',
					numeric: 1,
				},
			}),
		)
		expect(published).toHaveLength(2)

		const alternateNode = node({
			values: {
				mode: value({ value: 'heat' }),
				setpoint,
				fan,
				action,
				temperature: value({ unit: undefined }),
			},
		})
		generator.discoverDevice(
			alternateNode,
			device({
				type: 'climate',
				object_id: 'alternate',
				values: ['mode', 'setpoint', 'fan', 'action', 'temperature'],
				default_setpoint: 'setpoint',
				discovery_payload: {
					mode_state_topic: 'mode',
					fan_mode_state_topic: 'fan',
					action_topic: 'action',
					current_temperature_topic: 'temperature',
					precision: 1,
				},
			}),
		)
		expect(published).toHaveLength(3)
	})

	it('builds RGB discovery for binary and white controls', () => {
		const currentColor = value({
			id: '2-51-0-currentColor',
			commandClass: CommandClasses['Color Switch'],
			property: 'currentColor',
			type: 'color',
			targetValue: '51-0-targetColor',
		})
		const binary = value({
			id: '2-37-0-currentValue',
			targetValue: '37-0-targetValue',
		})
		const hassNode = node({
			values: {
				'51-0-currentColor': currentColor,
				'37-0-currentValue': binary,
				'51-0-currentColor-0': value(),
			},
		})
		const { generator } = setup({})
		const rgb = generator.addRgbColorSwitch(hassNode, currentColor)
		expect(rgb.discovery_payload.supported_color_modes).toEqual([
			'rgb',
			'onoff',
			'white',
		])
		expect(rgb.discovery_payload.on_command_type).toBe('last')
		expect(rgb.values).toContain('37-0-currentValue')

		const colorOnly = generator.addRgbColorSwitch(
			node({ values: {} }),
			currentColor,
		)
		expect(colorOnly.discovery_payload.supported_color_modes).toEqual([
			'rgb',
		])
	})

	it('discovers switch and configuration values through typed topic ports', () => {
		const binary = value({ isCurrentValue: true, targetValue: 'target' })
		const configValue = value({
			id: '2-112-0-1',
			commandClass: CommandClasses.Configuration,
			property: 1,
			propertyName: 'Parameter 1',
			type: 'number',
			writeable: true,
			min: 0,
			max: 10,
			value: 5,
		})
		const hassNode = node({
			values: {
				'37-0-currentValue': binary,
				'112-0-1': configValue,
			},
		})
		const { generator, published } = setup({})

		generator.discoverValue(hassNode, '37-0-currentValue')
		generator.discoverValue(hassNode, '112-0-1')
		expect(published).toHaveLength(2)
		expect(Object.values(hassNode.hassDevices)).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ type: 'switch' }),
				expect.objectContaining({ type: 'number' }),
			]),
		)

		const ignored = value({
			id: '2-112-0-2',
			commandClass: CommandClasses.Configuration,
			property: 2,
			type: 'string',
			writeable: true,
		})
		hassNode.values['112-0-2'] = ignored
		generator.discoverValue(hassNode, '112-0-2')
		expect(published).toHaveLength(2)

		const pulse = value({
			id: '2-53-0-count',
			commandClass: CommandClasses['Pulse Meter'],
			property: 'count',
			type: 'number',
			value: { unit: 5 },
		})
		hassNode.values.pulse = pulse
		generator.discoverValue(hassNode, 'pulse')
		expect(published).toHaveLength(3)
	})

	it('discovers generated climates and skips unsupported thermostat nodes', () => {
		const thermostat = node({
			deviceClass: { generic: 0x08, specific: 1 },
			values: {
				mode: value({
					id: '2-64-0-mode',
					commandClass: CommandClasses['Thermostat Mode'],
					property: 'mode',
					type: 'number',
					states: [
						{ value: 0, text: 'Off' },
						{ value: 1, text: 'Heat' },
						{ value: 2, text: 'Cool' },
					],
				}),
				setpoint: value({
					id: '2-67-0-setpoint-1',
					commandClass: CommandClasses['Thermostat Setpoint'],
					property: 'setpoint',
					propertyKey: 1,
					type: 'number',
				}),
				action: value({
					id: '2-66-0-state',
					commandClass: CommandClasses['Thermostat Operating State'],
					property: 'state',
					type: 'number',
					states: [
						{ value: 0, text: 'Idle' },
						{ value: 1, text: 'Heating' },
						{ value: 99, text: 'Unknown' },
					],
				}),
			},
		})
		const { generator, catalog, logWarn } = setup({})

		generator.discoverClimates(node())
		generator.discoverClimates(
			node({
				deviceClass: { generic: 0x08, specific: 1 },
				values: {},
			}),
		)
		expect(logWarn).toHaveBeenCalled()

		generator.discoverClimates(thermostat)
		expect(catalog.get(thermostat.deviceId)?.[0]).toMatchObject({
			type: 'climate',
			mode_map: { off: 0, heat: 1, cool: 2 },
		})
		generator.discoverClimates(thermostat)
		expect(catalog.get(thermostat.deviceId)).toHaveLength(1)
	})
})
