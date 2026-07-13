import { CommandClasses } from '@zwave-js/core'
import {
	ThermostatFanMode,
	ThermostatMode,
	ThermostatOperatingState,
	ThermostatSetpointType,
} from 'zwave-js'
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
import type {
	HassDevice,
	HassDeviceCatalog,
	HassDeviceMap,
} from '../../../api/hass/types.ts'
import { PayloadType } from '../../../api/lib/shared.ts'
import { cleanupTestEnv, ensureTestEnv, TEST_SESSION_SECRET } from './env.ts'

const GENERIC_DEVICE_CLASS_THERMOSTAT = 0x08
const GENERIC_DEVICE_CLASS_BINARY_SWITCH = 0x10
const HEATING_THERMOSTAT_SPECIFIC_DEVICE_CLASS = 1
const BINARY_POWER_SWITCH_SPECIFIC_DEVICE_CLASS = 1
const UNRECOGNIZED_THERMOSTAT_OPERATING_STATE = 99

function ccValueKey(
	commandClass: CommandClasses,
	property: string | number,
	propertyKey?: string | number,
): string {
	return [commandClass, 0, property, propertyKey]
		.filter((part) => part !== undefined)
		.join('-')
}

function ccValueId(
	commandClass: CommandClasses,
	property: string | number,
	propertyKey?: string | number,
): string {
	return `2-${ccValueKey(commandClass, property, propertyKey)}`
}

const BINARY_SWITCH_CURRENT_VALUE = ccValueKey(
	CommandClasses['Binary Switch'],
	'currentValue',
)
const BINARY_SWITCH_CURRENT_VALUE_ID = ccValueId(
	CommandClasses['Binary Switch'],
	'currentValue',
)

let DiscoveryGenerator: typeof DiscoveryGeneratorType

beforeAll(async () => {
	const isolatedStoreDir = ensureTestEnv()
	const [discoveryModule, configModule] = await Promise.all([
		import('../../../api/hass/DiscoveryGenerator.ts'),
		import('../../../api/config/app.ts'),
	])
	DiscoveryGenerator = discoveryModule.DiscoveryGenerator
	expect(configModule.storeDir).toBe(isolatedStoreDir)
	expect(configModule.logsDir.startsWith(isolatedStoreDir)).toBe(true)
	expect(configModule.sessionSecret).toBe(TEST_SESSION_SECRET)
})

afterAll(() => {
	cleanupTestEnv()
	vi.resetModules()
})

function value(overrides: Partial<HassValue> = {}): HassValue {
	return {
		id: BINARY_SWITCH_CURRENT_VALUE_ID,
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
		deviceClass: {
			generic: GENERIC_DEVICE_CLASS_BINARY_SWITCH,
			specific: BINARY_POWER_SWITCH_SPECIFIC_DEVICE_CLASS,
		},
		...overrides,
	}
}

function device(overrides: Partial<HassDevice> = {}): HassDevice {
	return {
		type: 'sensor',
		object_id: 'test',
		discovery_payload: {},
		values: [BINARY_SWITCH_CURRENT_VALUE],
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
	it('rediscovers valid nodes and updates disabled or removed entries', () => {
		const hassNode = node({
			name: 'Switch',
			manufacturer: 'Test',
			productDescription: 'Wall',
			productLabel: 'Switch',
			firmwareVersion: '1.0.0',
			hassDevices: { old: device() },
			values: {
				[BINARY_SWITCH_CURRENT_VALUE]: value({
					isCurrentValue: true,
				}),
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
				command_topic: `prefix/node/${BINARY_SWITCH_CURRENT_VALUE_ID}/set`,
				state_topic: `prefix/node/${BINARY_SWITCH_CURRENT_VALUE_ID}`,
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
				unique_id: `zwavejs2mqtt_0x12345678_${BINARY_SWITCH_CURRENT_VALUE_ID}`,
			},
			discoveryTopic: 'switch/Switch/switch/config',
			values: [BINARY_SWITCH_CURRENT_VALUE],
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

	it('publishes the configured suggested area through discovery', () => {
		const currentValue = value({ isCurrentValue: true })
		const hassNode = node({
			name: 'Switch',
			loc: '  Kitchen  ',
			values: { [BINARY_SWITCH_CURRENT_VALUE]: currentValue },
		})
		const { generator, published } = setup({
			config: { useLocationAsSuggestedArea: true },
		})

		generator.discoverDevice(hassNode, device())

		expect(published).toHaveLength(1)
		expect(published[0].payload).toMatchObject({
			device: { suggested_area: 'Kitchen' },
		})
	})

	it('publishes raw deletion payloads and removes deleted devices', () => {
		const { generator, published, updates, discovered } = setup({
			config: {
				payloadType: PayloadType.RAW,
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
		expect(discovered[BINARY_SWITCH_CURRENT_VALUE_ID]).toBe(hassDevice)

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
		expect(discovered[BINARY_SWITCH_CURRENT_VALUE_ID]).toBeUndefined()

		const rawWithoutBinaryPayloads = setup({
			config: { payloadType: PayloadType.RAW },
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

	it('logs publication failures and skips disabled discovery', () => {
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

		const failed = setup({ publishError: new Error('publish failed') })
		failed.generator.publishDiscovery(
			device({ discoveryTopic: 'bad/config' }),
			2,
		)
		expect(failed.log).toHaveBeenCalledWith(
			'error',
			expect.stringContaining('publish failed'),
			expect.any(Object),
		)
	})

	it('republishes persistent devices for valid nodes', () => {
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

	it('translates thermostat modes and stops covers', async () => {
		const fan = value({
			id: ccValueId(CommandClasses['Thermostat Fan Mode'], 'mode'),
			commandClass: CommandClasses['Thermostat Fan Mode'],
			property: 'mode',
			type: 'number',
			list: true,
		})
		const mode = value({
			id: ccValueId(CommandClasses['Thermostat Mode'], 'mode'),
			commandClass: CommandClasses['Thermostat Mode'],
			property: 'mode',
			type: 'number',
			list: true,
		})
		const cover = value({
			id: ccValueId(CommandClasses['Multilevel Switch'], 'targetValue'),
			commandClass: CommandClasses['Multilevel Switch'],
			property: 'targetValue',
			type: 'number',
		})
		const { generator, discovered, writes } = setup({})
		discovered[fan.id] = device({
			fan_mode_map: { auto: ThermostatFanMode['Auto low'] },
		})
		discovered[mode.id] = device({
			mode_map: { heat: ThermostatMode.Heat },
		})
		discovered[cover.id] = device({
			type: 'cover',
			discovery_payload: { payload_stop: 'HALT' },
		})

		expect(generator.transformPayload('auto', fan)).toBe(
			ThermostatFanMode['Auto low'],
		)
		expect(generator.transformPayload('heat', mode)).toBe(
			ThermostatMode.Heat,
		)
		expect(generator.transformPayload(ThermostatMode.Heat, mode)).toBe(
			ThermostatMode.Heat,
		)
		expect(generator.transformPayload('unchanged', value())).toBe(
			'unchanged',
		)
		expect(generator.transformPayload('HALT', cover)).toBeNull()
		await vi.waitFor(() => expect(writes).toEqual([cover]))
	})

	it('publishes setpoint topics for the current thermostat mode', () => {
		const setpoint = value({
			id: ccValueId(
				CommandClasses['Thermostat Setpoint'],
				'setpoint',
				ThermostatSetpointType.Heating,
			),
			commandClass: CommandClasses['Thermostat Setpoint'],
			property: 'setpoint',
			type: 'number',
		})
		const mode = value({
			id: ccValueId(CommandClasses['Thermostat Mode'], 'mode'),
			commandClass: CommandClasses['Thermostat Mode'],
			property: 'mode',
			value: ThermostatMode.Heat,
			type: 'number',
		})
		const climate = device({
			type: 'climate',
			discoveryTopic: 'climate/node/config',
			setpoint_topic: {
				[ThermostatSetpointType.Heating]: ccValueKey(
					CommandClasses['Thermostat Setpoint'],
					'setpoint',
					ThermostatSetpointType.Heating,
				),
			},
			mode_map: {
				off: ThermostatMode.Off,
				heat: ThermostatMode.Heat,
			},
		})
		const hassNode = node({
			values: {
				[ccValueKey(
					CommandClasses['Thermostat Setpoint'],
					'setpoint',
					ThermostatSetpointType.Heating,
				)]: setpoint,
			},
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

		mode.value = ThermostatMode.Off
		generator.updateClimateDiscovery(mode, hassNode, true)
		expect(published).toHaveLength(1)
	})

	it('publishes valid custom climates and rejects incomplete devices', () => {
		const mode = value({
			id: ccValueId(CommandClasses['Thermostat Mode'], 'mode'),
			commandClass: CommandClasses['Thermostat Mode'],
			property: 'mode',
			type: 'number',
			value: ThermostatMode.Heat,
		})
		const setpoint = value({
			id: ccValueId(
				CommandClasses['Thermostat Setpoint'],
				'setpoint',
				ThermostatSetpointType.Heating,
			),
			commandClass: CommandClasses['Thermostat Setpoint'],
			property: 'setpoint',
			type: 'number',
			value: 21,
		})
		const fan = value({
			id: ccValueId(CommandClasses['Thermostat Fan Mode'], 'mode'),
			commandClass: CommandClasses['Thermostat Fan Mode'],
			property: 'mode',
			type: 'number',
		})
		const action = value({
			id: ccValueId(
				CommandClasses['Thermostat Operating State'],
				'state',
			),
			commandClass: CommandClasses['Thermostat Operating State'],
			property: 'state',
			type: 'number',
		})
		const temperature = value({
			id: ccValueId(
				CommandClasses['Multilevel Sensor'],
				'Air temperature',
			),
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
			setpoint_topic: {
				[ThermostatSetpointType.Heating]: 'setpoint',
			},
			mode_map: {
				off: ThermostatMode.Off,
				heat: ThermostatMode.Heat,
			},
			fan_mode_map: { auto: ThermostatFanMode['Auto low'] },
			action_map: {
				[ThermostatOperatingState.Idle]: 'idle',
				[ThermostatOperatingState.Heating]: 'heating',
			},
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

	it('discovers RGB lights with binary and white controls', () => {
		const currentColor = value({
			id: ccValueId(CommandClasses['Color Switch'], 'currentColor'),
			commandClass: CommandClasses['Color Switch'],
			property: 'currentColor',
			type: 'color',
			targetValue: ccValueKey(
				CommandClasses['Color Switch'],
				'targetColor',
			),
		})
		const binary = value({
			id: BINARY_SWITCH_CURRENT_VALUE_ID,
			targetValue: ccValueKey(
				CommandClasses['Binary Switch'],
				'targetValue',
			),
		})
		const hassNode = node({
			values: {
				[ccValueKey(CommandClasses['Color Switch'], 'currentColor')]:
					currentColor,
				[BINARY_SWITCH_CURRENT_VALUE]: binary,
				[ccValueKey(CommandClasses['Color Switch'], 'currentColor', 0)]:
					value(),
			},
		})
		const { generator } = setup({})
		generator.discoverValue(
			hassNode,
			ccValueKey(CommandClasses['Color Switch'], 'currentColor'),
		)
		const rgb = Object.values(hassNode.hassDevices).find(
			(candidate) => candidate.type === 'light',
		)
		expect(rgb).toBeDefined()
		expect(rgb.discovery_payload.supported_color_modes).toEqual([
			'rgb',
			'onoff',
			'white',
		])
		expect(rgb.discovery_payload.on_command_type).toBe('last')
		expect(rgb.values).toContain(BINARY_SWITCH_CURRENT_VALUE)
	})

	it('discovers switch and writable configuration entities', () => {
		const binary = value({ isCurrentValue: true, targetValue: 'target' })
		const configValue = value({
			id: ccValueId(CommandClasses.Configuration, 1),
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
				[BINARY_SWITCH_CURRENT_VALUE]: binary,
				[ccValueKey(CommandClasses.Configuration, 1)]: configValue,
			},
		})
		const { generator, published } = setup({})

		generator.discoverValue(hassNode, BINARY_SWITCH_CURRENT_VALUE)
		generator.discoverValue(
			hassNode,
			ccValueKey(CommandClasses.Configuration, 1),
		)
		expect(published).toHaveLength(2)
		expect(Object.values(hassNode.hassDevices)).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ type: 'switch' }),
				expect.objectContaining({ type: 'number' }),
			]),
		)

		const ignored = value({
			id: ccValueId(CommandClasses.Configuration, 2),
			commandClass: CommandClasses.Configuration,
			property: 2,
			type: 'string',
			writeable: true,
		})
		const ignoredKey = ccValueKey(CommandClasses.Configuration, 2)
		hassNode.values[ignoredKey] = ignored
		generator.discoverValue(hassNode, ignoredKey)
		expect(published).toHaveLength(2)

		const pulse = value({
			id: ccValueId(CommandClasses['Pulse Meter'], 'count'),
			commandClass: CommandClasses['Pulse Meter'],
			property: 'count',
			type: 'number',
			value: { unit: 5 },
		})
		hassNode.values.pulse = pulse
		generator.discoverValue(hassNode, 'pulse')
		expect(published).toHaveLength(3)
	})

	it('discovers thermostat climates and skips unsupported nodes', () => {
		const thermostat = node({
			deviceClass: {
				generic: GENERIC_DEVICE_CLASS_THERMOSTAT,
				specific: HEATING_THERMOSTAT_SPECIFIC_DEVICE_CLASS,
			},
			values: {
				mode: value({
					id: ccValueId(CommandClasses['Thermostat Mode'], 'mode'),
					commandClass: CommandClasses['Thermostat Mode'],
					property: 'mode',
					type: 'number',
					states: [
						{ value: ThermostatMode.Off, text: 'Off' },
						{ value: ThermostatMode.Heat, text: 'Heat' },
						{ value: ThermostatMode.Cool, text: 'Cool' },
					],
				}),
				setpoint: value({
					id: ccValueId(
						CommandClasses['Thermostat Setpoint'],
						'setpoint',
						ThermostatSetpointType.Heating,
					),
					commandClass: CommandClasses['Thermostat Setpoint'],
					property: 'setpoint',
					propertyKey: ThermostatSetpointType.Heating,
					type: 'number',
				}),
				action: value({
					id: ccValueId(
						CommandClasses['Thermostat Operating State'],
						'state',
					),
					commandClass: CommandClasses['Thermostat Operating State'],
					property: 'state',
					type: 'number',
					states: [
						{
							value: ThermostatOperatingState.Idle,
							text: 'Idle',
						},
						{
							value: ThermostatOperatingState.Heating,
							text: 'Heating',
						},
						{
							value: UNRECOGNIZED_THERMOSTAT_OPERATING_STATE,
							text: 'Unknown',
						},
					],
				}),
			},
		})
		const { generator, catalog, logWarn } = setup({})

		generator.discoverClimates(node())
		generator.discoverClimates(
			node({
				deviceClass: {
					generic: GENERIC_DEVICE_CLASS_THERMOSTAT,
					specific: HEATING_THERMOSTAT_SPECIFIC_DEVICE_CLASS,
				},
				values: {},
			}),
		)
		expect(logWarn).toHaveBeenCalled()

		generator.discoverClimates(thermostat)
		expect(
			catalog
				.get(thermostat.deviceId)
				?.find((candidate) => candidate.type === 'climate'),
		).toMatchObject({
			type: 'climate',
			mode_map: {
				off: ThermostatMode.Off,
				heat: ThermostatMode.Heat,
				cool: ThermostatMode.Cool,
			},
		})
		const firstProjection = structuredClone(
			catalog.get(thermostat.deviceId),
		)
		generator.discoverClimates(thermostat)
		expect(catalog.get(thermostat.deviceId)).toEqual(firstProjection)
	})
})
