/**
 * Characterizes the two static Home Assistant discovery catalogs:
 *   - `api/hass/configurations.ts` - the per-entity-type discovery templates
 *     `Gateway.discoverValue()` clones (`hassCfg.switch`, `hassCfg.lock`, ...).
 *   - `api/hass/devices.ts` - the per-`deviceId` override list
 *     `Gateway.discoverDevice()`/`rediscoverNode()` look up in `allDevices`.
 *
 * These are pure data modules (only `import type`, zero filesystem/runtime
 * side effects), so they're imported statically here - no STORE_DIR
 * isolation needed.
 *
 * The point of these tests is NOT "the module imports" (that proves
 * nothing): each assertion pins a specific, semantically-meaningful value -
 * an entity `type`, an `object_id`, a Jinja template string, a mode/setpoint
 * map, a device-id -> config wiring - so that an accidental edit to a
 * template, a renamed key, a dropped device mapping, or a changed default
 * (all of which silently change what entities Home Assistant creates and how
 * they behave) fails loudly here and must be updated deliberately.
 *
 * Several locked values are known quirks (e.g. the Intermatic PE653
 * `circuit_4` switch whose `state_topic` points at circuit *1*); they are
 * pinned exactly as-is, with a comment, so the characterization reflects
 * real current behavior rather than an idealized version of it.
 */
import { describe, it, expect } from 'vitest'
import hassCfg from '../../../api/hass/configurations.ts'
import hassDevices from '../../../api/hass/devices.ts'

describe('HASS catalog: configurations.ts', () => {
	it('exposes exactly the known set of entity-type keys (no additions/removals)', () => {
		expect(Object.keys(hassCfg).sort()).toStrictEqual(
			[
				'barrier_state',
				'binary_sensor',
				'central_scene',
				'config_number',
				'config_switch',
				'cover',
				'cover_position',
				'fan',
				'light_dimmer',
				'light_rgb_dimmer',
				'lock',
				'sensor_generic',
				'sound_switch',
				'switch',
				'thermostat',
				'volume_dimmer',
			].sort(),
		)
	})

	it("locks every entry's HA component `type` and `object_id`", () => {
		const typeAndObject = Object.fromEntries(
			Object.entries(hassCfg).map(([k, v]) => [
				k,
				`${v.type}/${v.object_id}`,
			]),
		)
		expect(typeAndObject).toStrictEqual({
			binary_sensor: 'binary_sensor/event',
			sensor_generic: 'sensor/generic',
			central_scene: 'sensor/scene_state',
			light_rgb_dimmer: 'light/rgb_dimmer',
			light_dimmer: 'light/dimmer',
			volume_dimmer: 'light/volume_dimmer',
			switch: 'switch/switch',
			cover: 'cover/cover',
			cover_position: 'cover/position',
			barrier_state: 'cover/barrier_state',
			lock: 'lock/lock',
			thermostat: 'climate/climate',
			fan: 'fan/fan',
			sound_switch: 'fan/sound_switch',
			config_switch: 'switch/config_switch',
			config_number: 'number/config_number',
		})
	})

	it('binary_sensor: on=true/off=false with passthrough value_template', () => {
		expect(hassCfg.binary_sensor).toStrictEqual({
			type: 'binary_sensor',
			object_id: 'event',
			discovery_payload: {
				payload_on: true,
				payload_off: false,
				value_template: '{{ value_json.value }}',
			},
		})
	})

	it('switch: boolean payloads + command_topic marker', () => {
		expect(hassCfg.switch.discovery_payload).toStrictEqual({
			payload_off: false,
			payload_on: true,
			value_template: '{{ value_json.value }}',
			command_topic: true,
		})
	})

	it('light_dimmer: brightness scale 99 and OFF/ON state template', () => {
		const p = hassCfg.light_dimmer.discovery_payload
		expect(p.brightness_scale).toBe(99)
		expect(p.on_command_type).toBe('brightness')
		expect(p.state_value_template).toBe(
			'{{ "OFF" if value_json.value == 0 else "ON" }}',
		)
	})

	it('light_rgb_dimmer: rgb command/value templates and scale 99', () => {
		const p = hassCfg.light_rgb_dimmer.discovery_payload
		expect(p.brightness_scale).toBe(99)
		expect(p.rgb_command_template).toBe(
			"{{ {'red': red, 'green': green, 'blue': blue}|to_json }}",
		)
		expect(p.rgb_value_template).toBe(
			'{{ value_json.value.red }},{{ value_json.value.green }},{{ value_json.value.blue }}',
		)
	})

	it('volume_dimmer: scale 100, on_command_type=last, on=25/off=0, no state_topic', () => {
		const p = hassCfg.volume_dimmer.discovery_payload
		expect(p.brightness_scale).toBe(100)
		expect(p.on_command_type).toBe('last')
		expect(p.payload_on).toBe(25)
		expect(p.payload_off).toBe(0)
		// `state_topic: false` is a sentinel the discovery tail deletes -
		// locked here so that quirk can't silently flip to a real topic.
		expect(p.state_topic).toBe(false)
	})

	it('cover_position: open=99/closed=0, string payloads, round template', () => {
		expect(hassCfg.cover_position.discovery_payload).toStrictEqual({
			state_topic: false,
			command_topic: true,
			position_topic: true,
			set_position_topic: true,
			position_template: '{{ value_json.value | round(0) }}',
			position_open: 99,
			position_closed: 0,
			payload_open: '99',
			payload_close: '0',
			payload_stop: 'stop',
		})
	})

	it('barrier_state: numeric open/close/stop commands and state mapping + garage class', () => {
		const p = hassCfg.barrier_state.discovery_payload
		expect(p.device_class).toBe('garage')
		expect({
			payload_open: p.payload_open,
			payload_close: p.payload_close,
			payload_stop: p.payload_stop,
			state_open: p.state_open,
			state_opening: p.state_opening,
			state_closed: p.state_closed,
			state_closing: p.state_closing,
		}).toStrictEqual({
			payload_open: 255,
			payload_close: 0,
			payload_stop: 253,
			state_open: 255,
			state_opening: 254,
			state_closed: 0,
			state_closing: 252,
		})
	})

	it('lock: locked=255/unlocked=0 states and payloads', () => {
		expect(hassCfg.lock.discovery_payload).toStrictEqual({
			command_topic: true,
			state_locked: 255,
			state_unlocked: 0,
			payload_lock: 255,
			payload_unlock: 0,
			value_template: '{{ value_json.value }}',
		})
	})

	it('thermostat: default temp range 5-40 step 0.5 with empty modes seed', () => {
		const p = hassCfg.thermostat.discovery_payload
		expect(p.min_temp).toBe(5)
		expect(p.max_temp).toBe(40)
		expect(p.temp_step).toBe(0.5)
		expect(p.modes).toStrictEqual([])
	})

	it('fan: full 7-speed list and state/speed templates', () => {
		const p = hassCfg.fan.discovery_payload
		expect(p.speeds).toStrictEqual([
			'off',
			'low',
			'medium',
			'high',
			'on',
			'auto',
			'smart',
		])
		expect(p.command_topic_postfix).toBe('fan_state')
	})

	it('sound_switch: 4-speed list and volume payload mapping', () => {
		const p = hassCfg.sound_switch.discovery_payload
		expect(p.speeds).toStrictEqual(['off', 'low', 'medium', 'high'])
		expect({
			payload_low_speed: p.payload_low_speed,
			payload_medium_speed: p.payload_medium_speed,
			payload_high_speed: p.payload_high_speed,
			payload_off: p.payload_off,
			payload_on: p.payload_on,
		}).toStrictEqual({
			payload_low_speed: 10,
			payload_medium_speed: 25,
			payload_high_speed: 50,
			payload_off: 0,
			payload_on: 25,
		})
	})

	it('config_switch/config_number: disabled-by-default config-category entities', () => {
		expect(hassCfg.config_switch.discovery_payload.enabled_by_default).toBe(
			false,
		)
		expect(hassCfg.config_switch.discovery_payload.entity_category).toBe(
			'config',
		)
		expect(hassCfg.config_switch.discovery_payload.payload_off).toBe('0')
		expect(hassCfg.config_switch.discovery_payload.payload_on).toBe('1')
		expect(hassCfg.config_number.discovery_payload.enabled_by_default).toBe(
			false,
		)
		expect(hassCfg.config_number.discovery_payload.entity_category).toBe(
			'config',
		)
	})

	it('central_scene: state_topic marker and default-empty value template', () => {
		expect(hassCfg.central_scene.discovery_payload).toStrictEqual({
			state_topic: true,
			value_template: "{{ value_json.value | default('') }}",
		})
	})
})

describe('HASS catalog: devices.ts', () => {
	it('exposes exactly the known set of device ids', () => {
		expect(Object.keys(hassDevices).sort()).toStrictEqual(
			[
				'89-3-1',
				'411-1-1',
				'5-1619-20549',
				'57-12593-18756',
				'99-12340-18756',
				'99-12593-18756',
				'99-12600-18756',
				'99-12850-18756',
				'152-12-25857',
				'152-263-25601',
				'152-256-8194',
				'271-4096-770',
				'328-1-1',
				'328-1-3',
				'328-2-3',
				'328-3-3',
				'345-82-3',
				'622-23089-17235',
				'881-21-2',
				'129-1-20',
				'2-32784-3',
				'798-1-5',
				'798-1-10',
			].sort(),
		)
	})

	it('each device id maps to a non-empty list of HassDevice entries', () => {
		for (const [id, list] of Object.entries(hassDevices)) {
			expect(Array.isArray(list), `${id} is an array`).toBe(true)
			expect(list.length, `${id} non-empty`).toBeGreaterThan(0)
			for (const d of list) {
				expect(typeof d.type, `${id} entry has type`).toBe('string')
				expect(typeof d.object_id, `${id} entry has object_id`).toBe(
					'string',
				)
				expect(
					Array.isArray(d.values),
					`${id} entry has values[]`,
				).toBe(true)
			}
		}
	})

	it('the four GE/Honeywell dimmers all share ONE identical FAN_DIMMER config object', () => {
		const ids = [
			'57-12593-18756',
			'99-12340-18756',
			'99-12593-18756',
			'99-12600-18756',
			'99-12850-18756',
		]
		const first = hassDevices[ids[0]][0]
		for (const id of ids) {
			// referential identity: they're the same shared `FAN_DIMMER` const
			expect(hassDevices[id][0], `${id} shares FAN_DIMMER`).toBe(first)
		}
		expect(first.type).toBe('fan')
		expect(first.object_id).toBe('dimmer')
		expect(first.values).toStrictEqual([
			'38-0-currentValue',
			'38-0-targetValue',
		])
		expect(first.discovery_payload.payload_high_speed).toBe(99)
	})

	it('the three cover devices share ONE identical COVER config with the /99*100 position template', () => {
		const coverIds = ['271-4096-770', '345-82-3', '622-23089-17235']
		const cover = hassDevices[coverIds[0]][0]
		for (const id of coverIds) {
			expect(hassDevices[id][0], `${id} shares COVER`).toBe(cover)
		}
		expect(cover.discovery_payload.position_template).toBe(
			'{{ (value_json.value / 99 * 100) | round(0) }}',
		)
	})

	it('the Spirit Z-Wave Plus config is shared across all four of its device ids', () => {
		const spiritIds = ['328-1-3', '328-2-3', '328-3-3', '881-21-2']
		const spirit = hassDevices[spiritIds[0]][0]
		for (const id of spiritIds) {
			expect(hassDevices[id][0], `${id} shares SPIRIT`).toBe(spirit)
		}
		expect(spirit.mode_map).toStrictEqual({ off: 0, heat: 1, cool: 11 })
		expect(spirit.setpoint_topic).toStrictEqual({
			1: '67-0-setpoint-1',
			11: '67-0-setpoint-11',
		})
	})

	it('THERMOSTAT_2GIG (three radio thermostat ids) locks action/mode/fan maps', () => {
		const gigIds = ['152-12-25857', '152-263-25601', '152-256-8194']
		const gig = hassDevices[gigIds[0]][0]
		for (const id of gigIds) {
			expect(hassDevices[id][0], `${id} shares 2GIG`).toBe(gig)
		}
		expect(gig.action_map).toStrictEqual({
			0: 'idle',
			1: 'heating',
			2: 'cooling',
			3: 'fan',
		})
		expect(gig.mode_map).toStrictEqual({ off: 0, heat: 1, cool: 2 })
		expect(gig.fan_mode_map).toStrictEqual({ auto: 0, on: 1 })
	})

	it('Danfoss thermostat locks its 3-entry setpoint_topic map and default', () => {
		const danfoss = hassDevices['2-32784-3'][0]
		expect(danfoss.setpoint_topic).toStrictEqual({
			1: '67-0-setpoint-1',
			2: '67-0-setpoint-2',
			10: '67-0-setpoint-10',
		})
		expect(danfoss.default_setpoint).toBe('67-0-setpoint-1')
		expect(danfoss.discovery_payload.temp_step).toBe(0.1)
	})

	it('Intermatic PE653 is a one-to-many device: 2 climates + 5 switches, in order', () => {
		const list = hassDevices['5-1619-20549']
		expect(list.map((d) => `${d.type}/${d.object_id}`)).toStrictEqual([
			'climate/pool_thermostat',
			'climate/spa_thermostat',
			'switch/circuit_1',
			'switch/circuit_2',
			'switch/circuit_3',
			'switch/circuit_4',
			'switch/circuit_5',
		])
	})

	it('QUIRK: PE653 circuit_4 state_topic points at circuit_1 currentValue (locked as-is)', () => {
		const list = hassDevices['5-1619-20549']
		const circuit4 = list.find((d) => d.object_id === 'circuit_4')
		// This is almost certainly a copy/paste bug in the catalog, but it
		// is CURRENT behavior; lock it so a "fix" is a deliberate, reviewed
		// change, not an accidental characterization break.
		expect(circuit4.discovery_payload.state_topic).toBe('37-1-currentValue')
		expect(circuit4.discovery_payload.command_topic).toBe(
			'37-4-targetValue',
		)
	})

	it('Inovelli RGBW (two ids) share the color-temp/rgb template config', () => {
		const inovelli = hassDevices['798-1-5'][0]
		expect(hassDevices['798-1-10'][0]).toBe(inovelli)
		expect(inovelli.discovery_payload.min_mireds).toBe(153)
		expect(inovelli.discovery_payload.max_mireds).toBe(500)
		expect(inovelli.discovery_payload.brightness_scale).toBe('99')
		expect(inovelli.values).toStrictEqual([
			'38-0-currentValue',
			'38-0-targetValue',
			'51-0-currentColor',
			'51-0-targetColor',
		])
	})

	it('Siegenia Aeropac fan locks its 8-entry preset-mode list and speed range', () => {
		const aeropac = hassDevices['129-1-20'][0]
		expect(aeropac.discovery_payload.preset_modes).toStrictEqual([
			'off',
			'silent',
			'very low',
			'low',
			'medium',
			'high',
			'very high',
			'turbo',
		])
		expect(aeropac.discovery_payload.speed_range_min).toBe(1)
		expect(aeropac.discovery_payload.speed_range_max).toBe(7)
	})
})
