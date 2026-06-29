// Device projection tests.

import { describe, it, expect } from 'vitest'
import { CommandClasses } from '@zwave-js/core'
import type { ZUINode } from '../../api/lib/ZwaveClient'
import type { Device } from './dashboard-types'
import {
	projectDevice as _projectDevice,
	projectDevices as _projectDevices,
} from './deviceProjection.ts'

// Test fixtures are intentionally partial ZUINode objects — cast at the
// boundary so call sites stay readable.
const projectDevice = (n: any, opts?: any): Device =>
	_projectDevice(n as ZUINode, opts)
const projectDevices = (n: any[], opts?: any): Device[] =>
	_projectDevices(n as ZUINode[], opts)

function val(
	id: string,
	cc: number,
	property: any,
	value: any,
	extra: any = {},
) {
	return {
		id: `${id}`,
		nodeId: 1,
		commandClass: cc,
		property,
		propertyName:
			typeof property === 'string' ? property : String(property),
		value,
		...extra,
	}
}

function asValuesObj(arr: any[]) {
	const obj: Record<string, any> = {}
	for (const v of arr) obj[v.id] = v
	return obj
}

describe('projectDevice', () => {
	it('projects a controller node', () => {
		const d = projectDevice({
			id: 1,
			isControllerNode: true,
			name: 'Hub',
			manufacturer: 'Aeotec',
			productLabel: 'Z-Stick 7',
			firmwareVersion: '7.6',
			sdkVersion: '7.15.4',
			lastActive: Date.now(),
			values: {},
		})
		expect(d.isController).to.equal(true)
		expect(d.archetype.kind).to.equal('controller')
		expect(d.primaryValue).to.equal(null)
		expect(d.power.type).to.equal('mains')
	})

	it('projects a switch (Binary Switch)', () => {
		const node = {
			id: 5,
			productLabel: 'Smart Switch',
			values: asValuesObj([
				val('a', CommandClasses['Binary Switch'], 'currentValue', true),
			]),
			lastActive: Date.now(),
		}
		const d = projectDevice(node)
		expect(d.archetype.kind).to.equal('switch')
		expect(d.primaryValue).to.deep.include({ type: 'toggle', on: true })
	})

	it('reads switch state from targetValue when currentValue is absent', () => {
		const node = {
			id: 5,
			values: asValuesObj([
				val('a', CommandClasses['Binary Switch'], 'targetValue', true),
			]),
		}
		const d = projectDevice(node)
		expect(d.primaryValue).to.deep.include({ type: 'toggle', on: true })
	})

	it('projects an outlet (Binary Switch + Meter) with watts', () => {
		const node = {
			id: 6,
			values: asValuesObj([
				val('a', CommandClasses['Binary Switch'], 'currentValue', true),
				val('b', CommandClasses.Meter, 'value-65537', 42, {
					propertyName: 'Electric · Power',
					unit: 'W',
				}),
			]),
		}
		const d = projectDevice(node)
		expect(d.archetype.kind).to.equal('outlet')
		expect(d.primaryValue).to.deep.include({
			type: 'toggle',
			on: true,
			watts: 42,
		})
	})

	it('projects a dimmable light (Multilevel Switch)', () => {
		const node = {
			id: 7,
			values: asValuesObj([
				val(
					'a',
					CommandClasses['Multilevel Switch'],
					'currentValue',
					65,
				),
			]),
		}
		const d = projectDevice(node)
		expect(d.archetype.kind).to.equal('light')
		expect(d.primaryValue).to.deep.include({ type: 'dim', level: 65 })
	})

	it('projects a lock (Door Lock CC) and captures the targetMode write target', () => {
		const node = {
			id: 8,
			values: asValuesObj([
				val('a', CommandClasses['Door Lock'], 'currentMode', 255),
				val('t', CommandClasses['Door Lock'], 'targetMode', 255),
				val('b', CommandClasses.Battery, 'level', 78),
			]),
		}
		const d = projectDevice(node)
		expect(d.archetype.kind).to.equal('lock')
		expect(d.primaryValue).to.deep.include({ type: 'lock', locked: true })
		// The action layer writes to the writeable targetMode value, not the
		// read-only currentMode.
		expect(d.primaryValue).to.have.property('target')
		expect((d.primaryValue as any).target).to.deep.equal({
			commandClass: CommandClasses['Door Lock'],
			endpoint: 0,
			property: 'targetMode',
		})
		expect(d.power).to.deep.equal({ type: 'battery', battery: 78 })
	})

	it('projects a sensor (Multilevel Sensor)', () => {
		const node = {
			id: 9,
			values: asValuesObj([
				val(
					'a',
					CommandClasses['Multilevel Sensor'],
					'Air temperature',
					18.4,
					{
						propertyName: 'Air temperature',
						unit: '°C',
					},
				),
				val('b', CommandClasses.Battery, 'level', 88),
			]),
		}
		const d = projectDevice(node)
		expect(d.archetype.kind).to.equal('sensor')
		expect(d.primaryValue).to.deep.include({
			type: 'reading',
			value: 18.4,
			unit: '°C',
		})
	})

	it('projects a thermostat', () => {
		const node = {
			id: 10,
			values: asValuesObj([
				val(
					'a',
					CommandClasses['Thermostat Setpoint'],
					'setpoint',
					21,
					{ unit: '°C' },
				),
				val('b', CommandClasses['Thermostat Mode'], 'mode', 1, {
					states: [
						{ value: 0, text: 'Off' },
						{ value: 1, text: 'Heat' },
					],
				}),
				val(
					'c',
					CommandClasses['Multilevel Sensor'],
					'Air temperature',
					20.5,
					{
						propertyName: 'Air temperature',
						unit: '°C',
					},
				),
			]),
		}
		const d = projectDevice(node)
		expect(d.archetype.kind).to.equal('climate')
		expect(d.primaryValue).to.deep.include({
			type: 'thermostat',
			setpoint: 21,
			mode: 'Heat',
			value: 20.5,
			unit: '°C',
		})
	})

	it('flips status to dead', () => {
		const d = projectDevice({
			id: 11,
			status: 'Dead',
			values: asValuesObj([
				val(
					'a',
					CommandClasses['Binary Switch'],
					'currentValue',
					false,
				),
			]),
		})
		expect(d.status).to.equal('dead')
	})

	it('marks hasUpdate when availableFirmwareUpdates is non-empty', () => {
		const d = projectDevice({
			id: 12,
			availableFirmwareUpdates: [{ version: '1.2.3' }],
			values: {},
		})
		expect(d.hasUpdate).to.equal(true)
	})

	it('flags interview-in-progress', () => {
		const d = projectDevice({
			id: 13,
			interviewStage: 'CommandClasses',
			values: {},
		})
		expect(d.interviewState).to.equal('interview')
	})

	it('derives OTA activity from node.firmwareUpdate', () => {
		const d = projectDevice({
			id: 30,
			firmwareUpdate: {
				currentFile: 2,
				totalFiles: 4,
				sentFragments: 50,
				totalFragments: 100,
			},
			values: {},
		})
		// (2-1)*100 + 50 = 150 sent out of 400 total = 37.5 → 38
		expect(d.activity[0]).to.deep.equal({
			type: 'ota',
			label: 'Updating firmware',
			progress: 38,
		})
	})

	it('derives rebuild activity from rebuildRoutesProgress', () => {
		const d = projectDevice({
			id: 31,
			rebuildRoutesProgress: 'pending',
			values: {},
		})
		expect(d.activity.find((a) => a.type === 'rebuild')).toBeDefined()
	})

	it('derives interview activity with synthesized progress', () => {
		const d = projectDevice({
			id: 32,
			interviewStage: 'CommandClasses',
			interviewProgress: 60,
			values: {},
		})
		const iv = d.activity.find((a) => a.type === 'interview')
		expect(iv).to.deep.equal({
			type: 'interview',
			label: 'Interviewing',
			progress: 60,
		})
	})

	it('emits no interview activity once Complete', () => {
		const d = projectDevice({
			id: 33,
			interviewStage: 'Complete',
			values: {},
		})
		expect(d.activity.find((a) => a.type === 'interview')).to.equal(
			undefined,
		)
	})

	it('suppresses interview activity for Dead or Asleep nodes', () => {
		for (const status of ['Dead', 'Asleep'] as const) {
			const d = projectDevice({
				id: 34,
				interviewStage: 'CommandClasses',
				interviewProgress: 60,
				status,
				values: {},
			})
			expect(d.activity.find((a) => a.type === 'interview')).to.equal(
				undefined,
			)
		}
	})

	it('attaches activity entries from the registry', () => {
		const map = new Map()
		map.set(14, [{ type: 'ota', label: 'OTA', progress: 42 }])
		const d = projectDevice(
			{ id: 14, values: {} },
			{ activitiesByNode: map },
		)
		expect(d.activity).to.have.length(1)
		expect(d.activity[0]).to.deep.equal({
			type: 'ota',
			label: 'OTA',
			progress: 42,
		})
	})

	it('projectDevices maps an array', () => {
		const out = projectDevices([
			{ id: 1, isControllerNode: true, values: {} },
			{
				id: 2,
				values: asValuesObj([
					val(
						'a',
						CommandClasses['Binary Switch'],
						'currentValue',
						false,
					),
				]),
			},
		])
		expect(out).to.have.length(2)
		expect(out[0].isController).to.equal(true)
		expect(out[1].archetype.kind).to.equal('switch')
	})
})
