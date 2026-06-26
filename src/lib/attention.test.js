// Attention predicate tests.

import { describe, it, expect } from 'vitest'
import {
	deviceNeedsAttention,
	attentionReason,
	LOW_BATTERY_THRESHOLD,
} from './attention.ts'

function base(overrides = {}) {
	return {
		id: 1,
		nodeId: 1,
		isController: false,
		name: 'Test',
		location: '',
		archetype: {
			kind: 'switch',
			label: 'Switch',
			icon: null,
			power: 'mains',
		},
		power: { type: 'mains' },
		status: 'alive',
		interviewState: 'complete',
		securityKeys: [],
		lastSeen: 'now',
		primaryValue: null,
		activity: [],
		hasUpdate: false,
		...overrides,
	}
}

describe('deviceNeedsAttention', () => {
	it('does not flag the controller', () => {
		expect(
			deviceNeedsAttention(base({ isController: true, status: 'dead' })),
		).to.equal(false)
	})

	it('flags dead devices', () => {
		expect(deviceNeedsAttention(base({ status: 'dead' }))).to.equal(true)
	})

	it('flags battery node at 14% (below threshold)', () => {
		expect(
			deviceNeedsAttention(
				base({ power: { type: 'battery', battery: 14 } }),
			),
		).to.equal(true)
	})

	it('does not flag battery node at 16% (above threshold)', () => {
		expect(
			deviceNeedsAttention(
				base({ power: { type: 'battery', battery: 16 } }),
			),
		).to.equal(false)
	})

	it('threshold constant is 15', () => {
		expect(LOW_BATTERY_THRESHOLD).to.equal(15)
	})

	it('flags interview-incomplete when no interview activity', () => {
		expect(
			deviceNeedsAttention(base({ interviewState: 'interview' })),
		).to.equal(true)
	})

	it('does not double-count interview-in-progress with the activity scope', () => {
		expect(
			deviceNeedsAttention(
				base({
					interviewState: 'interview',
					activity: [
						{
							type: 'interview',
							label: 'Interviewing',
							progress: 40,
						},
					],
				}),
			),
		).to.equal(false)
	})

	it('flags hasUpdate', () => {
		expect(deviceNeedsAttention(base({ hasUpdate: true }))).to.equal(true)
	})

	it('flags weak signal on awake nodes', () => {
		expect(
			deviceNeedsAttention(base({ health: 'weak', status: 'alive' })),
		).to.equal(true)
	})

	it('does not flag weak signal on asleep nodes', () => {
		expect(
			deviceNeedsAttention(base({ health: 'weak', status: 'asleep' })),
		).to.equal(false)
	})

	it('does not flag healthy asleep battery device', () => {
		expect(
			deviceNeedsAttention(
				base({
					status: 'asleep',
					power: { type: 'battery', battery: 78 },
				}),
			),
		).to.equal(false)
	})
})

describe('attentionReason', () => {
	it('returns null when device is healthy', () => {
		expect(attentionReason(base())).to.equal(null)
	})
	it('returns "Dead" for dead devices', () => {
		expect(attentionReason(base({ status: 'dead' }))).to.equal('Dead')
	})
	it('returns low-battery percentage', () => {
		expect(
			attentionReason(base({ power: { type: 'battery', battery: 8 } })),
		).to.equal('Low battery (8%)')
	})
	it('returns weak-signal reason', () => {
		expect(
			attentionReason(base({ health: 'weak', status: 'alive' })),
		).to.equal('Weak signal')
	})
	it('returns update-available reason', () => {
		expect(attentionReason(base({ hasUpdate: true }))).to.equal(
			'Firmware update available',
		)
	})
})
