// Archetype catalogue tests.

import { describe, it, expect } from 'vitest'
import { CommandClasses } from '@zwave-js/core'
import { inferArchetype, productMatches } from './archetypes.ts'

function nodeWithCCs(ccs: number[], extra: any = {}) {
	const values: Record<string, any> = {}
	ccs.forEach((cc, i) => {
		values[`${i}-${cc}`] = { commandClass: cc }
	})
	return { values, ...extra }
}

describe('inferArchetype', () => {
	it('returns controller for the controller node', () => {
		const a = inferArchetype({ isControllerNode: true } as any)
		expect(a.kind).to.equal('controller')
	})

	it('returns lock for Door Lock CC', () => {
		const a = inferArchetype(nodeWithCCs([CommandClasses['Door Lock']]))
		expect(a.kind).to.equal('lock')
	})

	it('returns lock for Entry Control generic class', () => {
		const a = inferArchetype({
			deviceClass: { generic: 'Entry Control' },
			values: {},
		} as any)
		expect(a.kind).to.equal('lock')
	})

	it('returns light for Multilevel Switch CC', () => {
		const a = inferArchetype(
			nodeWithCCs([CommandClasses['Multilevel Switch']]),
		)
		expect(a.kind).to.equal('light')
	})

	it('returns shade when Multilevel Switch + shade product hint', () => {
		const a = inferArchetype(
			nodeWithCCs([CommandClasses['Multilevel Switch']], {
				productLabel: 'Roller Shade',
			}),
		)
		expect(a.kind).to.equal('shade')
	})

	it('returns outlet for Binary Switch + Meter', () => {
		const a = inferArchetype(
			nodeWithCCs([
				CommandClasses['Binary Switch'],
				CommandClasses.Meter,
			]),
		)
		expect(a.kind).to.equal('outlet')
	})

	it('returns switch for plain Binary Switch', () => {
		const a = inferArchetype(nodeWithCCs([CommandClasses['Binary Switch']]))
		expect(a.kind).to.equal('switch')
	})

	it('returns light for Binary Switch with bulb product hint', () => {
		const a = inferArchetype(
			nodeWithCCs([CommandClasses['Binary Switch']], {
				productLabel: 'Smart Bulb',
			}),
		)
		expect(a.kind).to.equal('light')
	})

	it('returns climate for Thermostat Setpoint', () => {
		const a = inferArchetype(
			nodeWithCCs([CommandClasses['Thermostat Setpoint']]),
		)
		expect(a.kind).to.equal('climate')
	})

	it('returns sensor for Multilevel Sensor', () => {
		const a = inferArchetype(
			nodeWithCCs([CommandClasses['Multilevel Sensor']]),
		)
		expect(a.kind).to.equal('sensor')
	})

	it('returns button for Central Scene without Battery', () => {
		const a = inferArchetype(nodeWithCCs([CommandClasses['Central Scene']]))
		expect(a.kind).to.equal('button')
	})

	it('returns remote for Central Scene + Battery', () => {
		const a = inferArchetype(
			nodeWithCCs([
				CommandClasses['Central Scene'],
				CommandClasses.Battery,
			]),
		)
		expect(a.kind).to.equal('remote')
	})

	it('returns unknown for an empty node', () => {
		const a = inferArchetype({ values: {} } as any)
		expect(a.kind).to.equal('unknown')
	})

	it('attaches label + icon for every archetype', () => {
		const a = inferArchetype({ values: {} } as any)
		expect(a.label).to.be.a('string')
		expect(a.label.length).to.be.above(0)
		expect(a.icon).toBeTruthy()
		expect(a.power).to.be.oneOf(['mains', 'battery', 'usb'])
	})
})

describe('productMatches', () => {
	it('matches productLabel substring case-insensitive', () => {
		expect(
			productMatches({ productLabel: 'Wall Plug' } as any, /plug/i),
		).to.equal(true)
	})
	it('matches productDescription substring case-insensitive', () => {
		expect(
			productMatches(
				{ productDescription: 'Z-Wave smart bulb' } as any,
				/bulb/i,
			),
		).to.equal(true)
	})
	it('returns false on no match', () => {
		expect(
			productMatches({ productLabel: 'Switch' } as any, /shade/i),
		).to.equal(false)
	})
})
