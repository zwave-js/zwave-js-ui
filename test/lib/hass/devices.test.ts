import { describe, it, expect } from 'vitest'

import devices from '../../../api/hass/devices.ts'

const VALUE_ID_TOPIC = /^\d+-\d+-/
const SETPOINT_VALUE_ID = /^67-\d+-setpoint-\d+$/

describe('#hass devices', () => {
	it('topics only reference values listed by the entity', () => {
		for (const [deviceId, entities] of Object.entries(devices)) {
			for (const entity of entities) {
				for (const [key, topic] of Object.entries(
					entity.discovery_payload,
				)) {
					if (
						!key.endsWith('_topic') ||
						typeof topic !== 'string' ||
						!VALUE_ID_TOPIC.test(topic)
					) {
						continue
					}
					expect(
						entity.values,
						`${deviceId} ${entity.object_id}.${key}`,
					).toContain(topic)
				}
			}
		}
	})

	it('setpoints are listed Thermostat Setpoint value IDs', () => {
		for (const [deviceId, entities] of Object.entries(devices)) {
			for (const entity of entities) {
				const setpoints = [
					entity.default_setpoint,
					...Object.values(entity.setpoint_topic ?? {}),
				].filter(Boolean)
				for (const setpoint of setpoints) {
					const label = `${deviceId} ${entity.object_id} ${setpoint}`
					expect(setpoint, label).toMatch(SETPOINT_VALUE_ID)
					expect(entity.values, label).toContain(setpoint)
				}
			}
		}
	})
})
