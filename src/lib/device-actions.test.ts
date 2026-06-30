// Device-action dispatch tests.
//
// Value-changing actions resolve to `writeValue` (→ `node.setValue`) targeting
// the `valueId` the action carries; the dispatcher reconstructs nothing.

import { describe, it, expect } from 'vitest'
import { CommandClasses } from '@zwave-js/core'
import { DoorLockMode, SetValueStatus } from '@zwave-js/cc'
import { dispatchAction, isRequestSuccess } from './device-actions.ts'
import type { Device } from './dashboard-types.ts'

const device = { nodeId: 8 } as Device

const lockTarget = {
	commandClass: CommandClasses['Door Lock'],
	endpoint: 0,
	property: 'targetMode' as const,
}

describe('dispatchAction', () => {
	it('writes the carried valueId with Secured mode to lock', () => {
		const req = dispatchAction(device, {
			type: 'lock',
			locked: true,
			valueId: lockTarget,
		})
		expect(req.api).to.equal('writeValue')
		expect(req.args[0]).to.deep.equal({ nodeId: 8, ...lockTarget })
		expect(req.args[1]).to.equal(DoorLockMode.Secured)
	})

	it('writes Unsecured mode to unlock', () => {
		const req = dispatchAction(device, {
			type: 'lock',
			locked: false,
			valueId: lockTarget,
		})
		expect(req.args[1]).to.equal(DoorLockMode.Unsecured)
	})

	it('preserves the valueId endpoint for multi-endpoint devices', () => {
		const req = dispatchAction(device, {
			type: 'lock',
			locked: true,
			valueId: { ...lockTarget, endpoint: 2 },
		})
		expect(req.args[0]).to.deep.equal({
			nodeId: 8,
			commandClass: CommandClasses['Door Lock'],
			endpoint: 2,
			property: 'targetMode',
		})
	})

	it('clamps dim level to 99', () => {
		const valueId = {
			commandClass: CommandClasses['Multilevel Switch'],
			endpoint: 0,
			property: 'targetValue' as const,
		}
		expect(
			dispatchAction(device, { type: 'dim', level: 100, valueId })
				.args[1],
		).to.equal(99)
		expect(
			dispatchAction(device, { type: 'dim', level: 42, valueId }).args[1],
		).to.equal(42)
	})

	it('maps node-management actions to their dedicated APIs', () => {
		expect(dispatchAction(device, { type: 'ping' })).to.deep.equal({
			api: 'pingNode',
			args: [8],
		})
		expect(dispatchAction(device, { type: 'refresh' })).to.deep.equal({
			api: 'refreshValues',
			args: [8],
		})
	})
})

describe('isRequestSuccess', () => {
	it('returns false for an unsuccessful response', () => {
		expect(isRequestSuccess('pingNode', { success: false })).to.equal(false)
	})

	it('returns true for a successful non-writeValue response', () => {
		expect(isRequestSuccess('pingNode', { success: true })).to.equal(true)
	})

	it('treats a successful writeValue with no result as success', () => {
		expect(isRequestSuccess('writeValue', { success: true })).to.equal(true)
	})

	it('honors the SetValueResult status for writeValue', () => {
		expect(
			isRequestSuccess('writeValue', {
				success: true,
				result: { status: SetValueStatus.Success },
			}),
		).to.equal(true)
		expect(
			isRequestSuccess('writeValue', {
				success: true,
				result: { status: SetValueStatus.Fail },
			}),
		).to.equal(false)
	})
})
