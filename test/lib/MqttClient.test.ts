import { describe, it, expect, vi } from 'vitest'
import MqttClient from '../../api/lib/MqttClient.ts'

describe('#MqttClient', () => {
	const setup = () => {
		const client = new MqttClient({ disabled: true } as any)
		const publish = vi.fn()
		client['config'] = { prefix: 'zwave', qos: 1, retain: true } as any
		client['client'] = { publish } as any
		return { client, publish }
	}

	describe('#publish()', () => {
		it('sends data as JSON', () => {
			const { client, publish } = setup()
			client.publish('a/b', '')
			expect(publish.mock.calls[0].slice(0, 3)).to.deep.equal([
				'zwave/a/b',
				'""',
				{ qos: 1, retain: true },
			])
		})
	})

	describe('#publishEmpty()', () => {
		it('sends a zero-length payload', () => {
			const { client, publish } = setup()
			client.publishEmpty(
				'config',
				{ qos: 0, retain: true },
				'homeassistant',
			)
			expect(publish.mock.calls[0].slice(0, 3)).to.deep.equal([
				'homeassistant/config',
				'',
				{ qos: 0, retain: true },
			])
		})
	})
})
