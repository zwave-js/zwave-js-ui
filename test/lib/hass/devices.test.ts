import { describe, it, expect } from 'vitest'

import devices from '../../../api/hass/devices.ts'

const VALUE_ID_TOPIC = /^\d+-\d+-/

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
})
