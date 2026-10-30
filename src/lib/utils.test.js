import { describe, expect, it } from 'vitest'
import { getRoute } from './utils.js'

describe('getRoute', () => {
	it('shows direct frames from source to destination', () => {
		expect(getRoute({ sourceNodeId: 64, destinationNodeId: 1 })).toBe(
			'64 → 1',
		)
	})

	it('shows outbound routed frames from source to destination', () => {
		expect(
			getRoute({
				sourceNodeId: 1,
				destinationNodeId: 64,
				direction: 'outbound',
				repeaters: [5],
			}),
		).toBe('1 → 5 → 64')
	})

	it('shows inbound routed frames with the source on the right', () => {
		expect(
			getRoute({
				sourceNodeId: 64,
				destinationNodeId: 1,
				direction: 'inbound',
				repeaters: [5],
			}),
		).toBe('1 ← 5 ← 64')
	})
})
