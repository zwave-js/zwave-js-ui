// Pending-key helper tests.
//
// These strings drive every value-pane spinner; a format or collision bug here
// silently breaks pending state, so the format and edge cases are pinned here.

import { describe, it, expect } from 'vitest'
import { CommandClasses, type ValueID } from '@zwave-js/core'
import {
	valueIdKey,
	setPendingKey,
	pollPendingKey,
	ccPendingKey,
	actionPendingKey,
} from './deviceActionPending.ts'
import type { Device } from './dashboard-types.ts'

const meterValue: ValueID = {
	commandClass: CommandClasses.Meter,
	endpoint: 0,
	property: 'value',
	propertyKey: 65537,
}

describe('valueIdKey', () => {
	it('formats cc-endpoint-property-propertyKey', () => {
		expect(valueIdKey(meterValue)).to.equal('50-0-value-65537')
	})

	it('defaults a missing endpoint to 0 and a missing propertyKey to empty', () => {
		expect(
			valueIdKey({
				commandClass: CommandClasses['Binary Switch'],
				property: 'currentValue',
			}),
		).to.equal('37-0-currentValue-')
	})

	it('distinguishes values that differ only by propertyKey', () => {
		const a = valueIdKey({ ...meterValue, propertyKey: 65537 })
		const b = valueIdKey({ ...meterValue, propertyKey: 66049 })
		expect(a).to.not.equal(b)
	})
})

describe('pending keys', () => {
	it('namespaces by node and operation', () => {
		expect(setPendingKey(8, meterValue)).to.equal('8:set:50-0-value-65537')
		expect(pollPendingKey(8, meterValue)).to.equal(
			'8:poll:50-0-value-65537',
		)
		expect(ccPendingKey(8, CommandClasses.Meter)).to.equal('8:cc:50')
	})

	it('does not collide across nodes, operations, or CCs', () => {
		const keys = new Set([
			setPendingKey(8, meterValue),
			setPendingKey(9, meterValue), // different node
			pollPendingKey(8, meterValue), // different op
			ccPendingKey(8, CommandClasses.Meter),
			ccPendingKey(8, CommandClasses.Battery),
		])
		expect(keys.size).to.equal(5)
	})
})

describe('actionPendingKey', () => {
	const device = { nodeId: 8 } as Device

	it('keys set / poll / refresh-cc actions', () => {
		expect(
			actionPendingKey(device, {
				type: 'set-value',
				valueId: meterValue,
				value: 1,
			}),
		).to.equal('8:set:50-0-value-65537')
		expect(
			actionPendingKey(device, {
				type: 'poll-value',
				valueId: meterValue,
			}),
		).to.equal('8:poll:50-0-value-65537')
		expect(
			actionPendingKey(device, {
				type: 'refresh-cc',
				commandClass: CommandClasses.Meter,
			}),
		).to.equal('8:cc:50')
	})

	it('returns null for actions the Values pane does not track', () => {
		expect(actionPendingKey(device, { type: 'ping' })).to.equal(null)
	})
})
