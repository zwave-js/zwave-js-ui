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
} from '#api/hass/DiscoveryGenerator'
import type {
	HassDeviceRegistryPort,
	HassLogger,
	HassMqttPort,
	HassNode,
	HassValue,
	HassZwavePort,
} from '#api/hass/ports'
import { ensureHassNode } from '#api/hass/ports'
import type {
	HassDevice,
	HassDeviceCatalog,
	HassDeviceMap,
} from '#api/hass/types'
import { getIdWithoutNode, PayloadType } from '#api/lib/shared'
import { cleanupTestEnv, ensureTestEnv, TEST_SESSION_SECRET } from './env.ts'
import { buildNode } from './fixtures.ts'
import { assertDefined } from '../testUtils.ts'

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
let hassCommandHandled: symbol

beforeAll(async () => {
	const isolatedStoreDir = ensureTestEnv()
	const [discoveryModule, configModule] = await Promise.all([
		import('#api/hass/DiscoveryGenerator'),
		import('#api/config/app'),
	])
	DiscoveryGenerator = discoveryModule.DiscoveryGenerator
	hassCommandHandled = discoveryModule.HASS_COMMAND_HANDLED
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
		commandClassName: 'Binary Switch',
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
	const result = buildNode({
		id: 2,
		ready: true,
		values: {},
		hassDevices: {},
		deviceId: '1-2-3',
		deviceClass: {
			basic: 0,
			generic: GENERIC_DEVICE_CLASS_BINARY_SWITCH,
			specific: BINARY_POWER_SWITCH_SPECIFIC_DEVICE_CLASS,
		},
		...overrides,
	})
	ensureHassNode(result)
	return result
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

function registerDiscovery(
	generator: DiscoveryGeneratorType,
	hassValue: HassValue,
	hassDevice: HassDevice,
): void {
	hassDevice.values = [getIdWithoutNode(hassValue)]
	generator.setDiscovery(hassValue.nodeId, hassDevice)
}

function setup(options: {
	config?: DiscoveryGeneratorOptions['config']
	disabled?: boolean
	nodes?: Map<number, HassNode>
	catalog?: HassDeviceCatalog
	publishError?: unknown
	withoutZwave?: boolean
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
	const writes: Array<{ valueId: HassValue; value: unknown }> = []
	const nodes = options.nodes ?? new Map<number, HassNode>()
	const catalog = new Map(
		Object.entries(options.catalog ?? {}).map(([key, devices]) => [
			key,
			[...devices],
		]),
	)
	const mqtt: HassMqttPort = {
		disabled: options.disabled ?? false,
		getTopic: (topic, set) => `prefix/${topic}${set ? '/set' : ''}`,
		getStatusTopic: () => 'prefix/_CLIENTS/ZWAVE_GATEWAY/status',
		publish: (topic, payload, publishOptions, prefix) => {
			if (options.publishError !== undefined) {
				// Exercise production normalization of non-Error throw values
				// eslint-disable-next-line @typescript-eslint/only-throw-error
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
		nodes,
		updateDevice: (hassDevice, nodeId, deleteDevice) => {
			updates.push({
				nodeId,
				devices: { updated: hassDevice },
				deleteDevice,
			})
		},
		writeValue: (valueId, value) => {
			writes.push({ valueId, value })
			return Promise.resolve({ status: 0 })
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
		zwave: options.withoutZwave ? undefined : zwave,
		nodeUpdates: {
			emitNodeUpdate: (nodeId, devices) =>
				emitted.push({ nodeId, devices }),
		},
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
		logger,
	})

	return {
		generator,
		published,
		updates,
		emitted,
		writes,
		logger,
		logDebug,
		logWarn,
		logError,
		log,
		catalog,
	}
}

describe('DiscoveryGenerator', () => {
	it('rediscovers nodes and updates disabled or removed entries', () => {
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
		const { generator, emitted, published } = setup({
			nodes: new Map<number, HassNode>([
				[2, hassNode],
				[4, node({ id: 4, virtual: true })],
			]),
		})
		generator.rediscoverNode(4)
		generator.rediscoverNode(2)
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
	})

	it('owns, resets, and removes entries from its discovery index', () => {
		const { generator } = setup({})
		const tracked = value({ id: '2-tracked' })
		const retained = value({ id: '9-retained', nodeId: 9 })
		registerDiscovery(generator, tracked, device())
		registerDiscovery(generator, retained, device())
		const discoverValue = vi
			.spyOn(generator, 'discoverValue')
			.mockImplementation(() => undefined)

		generator.discoverValueIfNeeded(node(), tracked)
		generator.removeNode({ id: 2 })
		generator.discoverValueIfNeeded(node(), tracked)
		generator.discoverValueIfNeeded(node({ id: 9 }), retained)
		expect(discoverValue).toHaveBeenCalledOnce()

		registerDiscovery(generator, tracked, device())
		generator.reset()
		generator.discoverValueIfNeeded(node(), tracked)
		expect(discoverValue).toHaveBeenCalledTimes(2)
	})

	it('publishes only configured non-blank suggested areas', () => {
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

		const withoutOption = setup({})
		withoutOption.generator.discoverDevice(
			node({
				name: 'Switch',
				loc: 'Kitchen',
				values: { [BINARY_SWITCH_CURRENT_VALUE]: currentValue },
			}),
			device(),
		)
		expect(withoutOption.published[0].payload).not.toHaveProperty(
			'device.suggested_area',
		)

		const blank = setup({
			config: { useLocationAsSuggestedArea: true },
		})
		blank.generator.discoverDevice(
			node({
				name: 'Switch',
				loc: '   ',
				values: { [BINARY_SWITCH_CURRENT_VALUE]: currentValue },
			}),
			device(),
		)
		expect(blank.published[0].payload).not.toHaveProperty(
			'device.suggested_area',
		)
	})

	it('publishes raw deletion payloads and removes deleted devices', () => {
		const { generator, published, updates } = setup({
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
		const discoverValue = vi
			.spyOn(generator, 'discoverValue')
			.mockImplementation(() => undefined)
		const hassNode = node()
		const hassValue = value()

		generator.publishDiscovery(hassDevice, 2)
		expect(published).toHaveLength(0)
		expect(hassDevice.discovery_payload.state_topic).toBe(
			"{{ value == 'true' }}",
		)
		generator.discoverValueIfNeeded(hassNode, hassValue)
		expect(discoverValue).not.toHaveBeenCalled()

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
		generator.discoverValueIfNeeded(hassNode, hassValue)
		expect(discoverValue).toHaveBeenCalledOnce()

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

		const missingTopic = setup({})
		missingTopic.generator.publishDiscovery(
			device({ discoveryTopic: undefined }),
			2,
			{ forceUpdate: true },
		)
		expect(missingTopic.log).toHaveBeenCalledWith(
			'error',
			expect.stringContaining('has no discovery topic'),
			expect.any(Object),
		)
		expect(missingTopic.updates).toHaveLength(0)
	})

	it('republishes persistent devices for valid nodes', () => {
		const stored = device({
			discoveryTopic: 'sensor/node/stored/config',
			persistent: true,
		})
		const nodes = new Map<number, HassNode>([
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

	it('the publication fence quiesces every producer and re-arms on activate', () => {
		const stored = device({
			discoveryTopic: 'sensor/node/stored/config',
			persistent: true,
			discovery_payload: { state_topic: 'x' },
		})
		const nodes = new Map<number, HassNode>([
			[2, node({ hassDevices: { stored } })],
		])
		const harness = setup({ nodes })
		const { generator, published, logDebug } = harness

		// Active by default.
		expect(generator.active).toBe(true)

		// Deactivate: publishDiscovery no-ops (retained publication fenced)...
		generator.deactivate()
		expect(generator.active).toBe(false)
		generator.publishDiscovery(
			device({ discoveryTopic: 'sensor/node/fenced/config' }),
			2,
		)
		expect(published).toHaveLength(0)
		expect(logDebug).toHaveBeenCalledWith(
			'Discovery is quiesced; skipping retained publication',
		)

		// ...and the status-driven rediscoverAll path publishes nothing either.
		generator.rediscoverAll()
		expect(published).toHaveLength(0)

		// Re-arm: publication resumes exactly once.
		generator.activate()
		expect(generator.active).toBe(true)
		generator.rediscoverAll()
		expect(published).toHaveLength(1)
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
		const { generator, writes } = setup({})
		registerDiscovery(
			generator,
			fan,
			device({
				fan_mode_map: { auto: ThermostatFanMode['Auto low'] },
			}),
		)
		registerDiscovery(
			generator,
			mode,
			device({
				mode_map: { heat: ThermostatMode.Heat },
			}),
		)
		registerDiscovery(
			generator,
			cover,
			device({
				type: 'cover',
				discovery_payload: { payload_stop: 'HALT' },
			}),
		)

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
		expect(generator.transformPayload('HALT', cover)).toBe(
			hassCommandHandled,
		)
		registerDiscovery(
			generator,
			cover,
			device({
				type: 'cover',
				discovery_payload: {},
			}),
		)
		expect(generator.transformPayload('STOP', cover)).toBe(
			hassCommandHandled,
		)
		await vi.waitFor(() =>
			expect(writes).toEqual([
				{
					valueId: { ...cover, property: 'Up' },
					value: false,
				},
				{
					valueId: { ...cover, property: 'Up' },
					value: false,
				},
			]),
		)
	})

	it('requires Z-Wave only when a cover command writes', () => {
		const cover = value({
			id: ccValueId(CommandClasses['Multilevel Switch'], 'targetValue'),
			commandClass: CommandClasses['Multilevel Switch'],
			property: 'targetValue',
			type: 'number',
		})
		const { generator } = setup({ withoutZwave: true })
		registerDiscovery(
			generator,
			cover,
			device({
				type: 'cover',
				discovery_payload: {},
			}),
		)

		expect(() => generator.transformPayload('STOP', cover)).toThrow(
			'Z-Wave client is not available',
		)
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
		const { generator, published } = setup({})
		registerDiscovery(generator, mode, climate)

		generator.updateClimateDiscovery(mode, hassNode, false)
		expect(published).toHaveLength(0)
		generator.updateClimateDiscovery(mode, hassNode, true)
		expect(climate.discovery_payload.temperature_state_topic).toContain(
			setpoint.id,
		)
		expect(published).toHaveLength(1)
		generator.updateClimateDiscovery(mode, hassNode, true)
		expect(published).toHaveLength(1)

		mode.value = ThermostatMode.Off
		generator.updateClimateDiscovery(mode, hassNode, true)
		expect(published).toHaveLength(1)

		delete climate.mode_map
		mode.value = 'heat'
		generator.updateClimateDiscovery(mode, hassNode, true)
		expect(published).toHaveLength(1)
	})

	it('skips inactive discovery lifecycle paths', () => {
		const hassNode = node({
			hassDevices: {
				transient: device({ persistent: false }),
			},
		})
		const hassValue = value()
		const { generator, published } = setup({
			config: { hassDiscovery: false },
		})

		generator.discoverValueIfNeeded(hassNode, hassValue)
		generator.onNodeInited(hassNode)

		expect(published).toHaveLength(0)
		expect(hassNode.hassDevices).toEqual({
			transient: device({ persistent: false }),
		})
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

		generator.discoverDevice(hassNode, {
			...climate,
			object_id: 'without_values',
			values: undefined,
		})
		expect(hassNode.hassDevices.climate_without_values).toBeDefined()
		expect(published).toHaveLength(1)

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

	it('preserves unresolved custom climate bounds', () => {
		const setpoint = value({
			id: '2-setpoint',
			property: 'setpoint',
			type: 'number',
		})
		const projectMaxTemp = (
			maxTemp: unknown,
			values: Record<string, HassValue> = {},
		) => {
			const { generator, published } = setup({})
			generator.discoverDevice(
				node({ values: { setpoint, ...values } }),
				device({
					type: 'climate',
					object_id: 'bounds',
					values: ['setpoint'],
					default_setpoint: 'setpoint',
					discovery_payload: { max_temp: maxTemp },
				}),
			)
			expect(published).toHaveLength(1)
			return published[0].payload
		}

		expect(projectMaxTemp(30)).toHaveProperty('max_temp', 30)
		expect(projectMaxTemp('missing')).toHaveProperty('max_temp', 'missing')
		expect(
			projectMaxTemp('empty', { empty: value({ value: null }) }),
		).toHaveProperty('max_temp', 'empty')
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
		assertDefined(rgb, 'expected an RGB light discovery')
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

	it.each([
		['multilevel sensor', CommandClasses['Multilevel Sensor']],
		['meter', CommandClasses.Meter],
	])('skips %s auxiliary values without metadata', (_label, commandClass) => {
		const key = ccValueKey(commandClass, 'reset')
		const hassNode = node({
			values: {
				[key]: value({
					id: ccValueId(commandClass, 'reset'),
					commandClass,
					property: 'reset',
					type: 'number',
					ccSpecific: undefined,
				}),
			},
		})

		const { generator, published, logError } = setup({})

		generator.discoverValue(hassNode, key)

		expect(published).toHaveLength(0)
		expect(hassNode.hassDevices).toEqual({})
		expect(logError).not.toHaveBeenCalled()
	})

	it('skips binary notifications without a discoverable object ID', () => {
		const key = ccValueKey(CommandClasses.Notification, 'unknown')
		const hassNode = node({
			values: {
				[key]: value({
					id: ccValueId(CommandClasses.Notification, 'unknown'),
					commandClass: CommandClasses.Notification,
					property: 'unknown',
					type: 'number',
					states: [
						{ value: 0, text: 'Idle' },
						{ value: 1, text: 'Active' },
					],
				}),
			},
		})
		const { generator, published } = setup({})

		generator.discoverValue(hassNode, key)

		expect(published).toHaveLength(0)
		expect(hassNode.hassDevices).toEqual({})
	})

	it('discovers thermostat climates and skips unsupported nodes', () => {
		const thermostat = node({
			deviceClass: {
				basic: 0,
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
					basic: 0,
					generic: GENERIC_DEVICE_CLASS_THERMOSTAT,
					specific: HEATING_THERMOSTAT_SPECIFIC_DEVICE_CLASS,
				},
				values: {},
			}),
		)
		expect(logWarn).toHaveBeenCalled()

		generator.discoverClimates(thermostat)
		const deviceId = thermostat.deviceId
		assertDefined(deviceId, 'thermostat fixture must have a device ID')
		expect(
			catalog
				.get(deviceId)
				?.find((candidate) => candidate.type === 'climate'),
		).toMatchObject({
			type: 'climate',
			mode_map: {
				off: ThermostatMode.Off,
				heat: ThermostatMode.Heat,
				cool: ThermostatMode.Cool,
			},
		})
		const firstProjection = structuredClone(catalog.get(deviceId))
		generator.discoverClimates(thermostat)
		expect(catalog.get(deviceId)).toEqual(firstProjection)
	})
})
