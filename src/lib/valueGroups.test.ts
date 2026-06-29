// Value-pane projection tests.
//
// `paramKind` / `formatValue` / `projectParam` are internal; they're exercised
// through the public `buildValueGroups`, asserting the projected `ValueParam`.

import { describe, it, expect } from 'vitest'
import { CommandClasses } from '@zwave-js/core'
import { buildValueGroups, DEFAULT_OPEN_CCS } from './valueGroups.ts'
import type { ZUINode } from '../../api/lib/ZwaveClient.ts'

// Minimal value with sensible defaults; override per test.
function val(o: Record<string, any> = {}): any {
	return {
		id: '1-37-0-currentValue',
		commandClass: CommandClasses['Binary Switch'],
		commandClassName: 'Binary Switch',
		commandClassVersion: 1,
		property: 'currentValue',
		type: 'boolean',
		writeable: true,
		readable: true,
		...o,
	}
}

function project(o: Record<string, any>) {
	const node = { values: [val(o)] } as unknown as ZUINode
	return buildValueGroups(node)[0].params[0]
}

describe('paramKind (via buildValueGroups)', () => {
	it('write-only boolean is a button, not a switch', () => {
		expect(
			project({ type: 'boolean', writeable: true, readable: false }).kind,
		).to.equal('button')
	})

	it('readable boolean is a switch', () => {
		expect(project({ type: 'boolean', readable: true }).kind).to.equal(
			'switch',
		)
	})

	it('Multilevel Switch currentValue is a level', () => {
		expect(
			project({
				commandClass: CommandClasses['Multilevel Switch'],
				property: 'currentValue',
				type: 'number',
			}).kind,
		).to.equal('level')
	})

	it('a 0–99 number is a level, but only without discrete states', () => {
		const base = { type: 'number', min: 0, max: 99, property: 'foo' }
		expect(project(base).kind).to.equal('level')
		// With states the enum (more specific) wins over the generic level.
		expect(
			project({
				...base,
				states: [
					{ value: 0, text: 'Off' },
					{ value: 99, text: 'On' },
				],
			}).kind,
		).to.equal('enum')
	})

	it('states render as enum unless free entry is allowed', () => {
		const states = [{ value: 1, text: 'One' }]
		expect(project({ type: 'number', states }).kind).to.equal('enum')
		expect(
			project({
				type: 'number',
				states,
				writeable: true,
				allowManualEntry: true,
			}).kind,
		).to.equal('number')
	})

	it('string and buffer are text; unsupported types are read-only readings', () => {
		expect(project({ type: 'string' }).kind).to.equal('text')
		expect(project({ type: 'buffer' }).kind).to.equal('text')
		expect(project({ type: 'duration' }).kind).to.equal('reading')
	})

	it('forces a writeable reading to read-only so it never renders an empty control', () => {
		const p = project({ type: 'duration', writeable: true })
		expect(p.kind).to.equal('reading')
		expect(p.readonly).to.equal(true)
	})
})

describe('formatValue (via buildValueGroups)', () => {
	it('formats switch / level / enum / number-with-unit', () => {
		expect(project({ type: 'boolean', value: true }).display).to.equal('ON')
		expect(
			project({
				commandClass: CommandClasses['Multilevel Switch'],
				property: 'currentValue',
				type: 'number',
				value: 50,
			}).display,
		).to.equal('50 %')
		expect(
			project({
				type: 'number',
				value: 1,
				states: [{ value: 1, text: 'One' }],
			}).display,
		).to.equal('[1] One')
		expect(
			project({ type: 'number', value: 42, unit: 'W' }).display,
		).to.equal('42 W')
	})

	it('renders unknown for null/undefined and JSON for objects', () => {
		expect(project({ type: 'number', value: undefined }).display).to.equal(
			'unknown',
		)
		expect(project({ type: 'any', value: { a: 1 } }).display).to.equal(
			'{"a":1}',
		)
	})
})

describe('projectParam (Configuration CC)', () => {
	const config = {
		commandClass: CommandClasses.Configuration,
		commandClassName: 'Configuration',
		property: 7,
		type: 'number',
	}

	it('flags a modified param and surfaces its number', () => {
		const p = project({ ...config, value: 5, default: 3 })
		expect(p.modified).to.equal(true)
		expect(p.paramNumber).to.equal('7')
	})

	it('is not modified when the value equals the default', () => {
		expect(project({ ...config, value: 3, default: 3 }).modified).to.equal(
			false,
		)
	})

	it('never flags modified for a non-Configuration value', () => {
		expect(
			project({ type: 'number', value: 5, default: 3 }).modified,
		).to.equal(false)
	})
})

describe('buildValueGroups', () => {
	it('returns [] for a node without values', () => {
		expect(buildValueGroups(null)).to.deep.equal([])
		expect(buildValueGroups({} as ZUINode)).to.deep.equal([])
	})

	it('groups values by command class in first-seen order', () => {
		const node = {
			values: [
				val({ id: 'a', commandClass: CommandClasses.Meter }),
				val({ id: 'b', commandClass: CommandClasses['Binary Switch'] }),
				val({ id: 'c', commandClass: CommandClasses.Meter }),
			],
		} as unknown as ZUINode
		const groups = buildValueGroups(node)
		expect(groups.map((g) => g.ccId)).to.deep.equal([
			CommandClasses.Meter,
			CommandClasses['Binary Switch'],
		])
		expect(groups[0].params).to.have.length(2)
	})

	it('offers reset-all only for Configuration CC v4+', () => {
		const make = (cc: number, version: number) =>
			buildValueGroups({
				values: [
					val({ commandClass: cc, commandClassVersion: version }),
				],
			} as unknown as ZUINode)[0].canResetAll
		expect(make(CommandClasses.Configuration, 4)).to.equal(true)
		expect(make(CommandClasses.Configuration, 3)).to.equal(false)
		expect(make(CommandClasses['Binary Switch'], 4)).to.equal(false)
	})
})

describe('DEFAULT_OPEN_CCS', () => {
	it('contains the common interactive CCs', () => {
		expect(
			DEFAULT_OPEN_CCS.has(CommandClasses['Multilevel Switch']),
		).to.equal(true)
		expect(DEFAULT_OPEN_CCS.has(CommandClasses.Meter)).to.equal(true)
		expect(DEFAULT_OPEN_CCS.has(CommandClasses.Configuration)).to.equal(
			false,
		)
	})
})
