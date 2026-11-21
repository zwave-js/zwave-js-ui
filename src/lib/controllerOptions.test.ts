import { describe, it, expect } from 'vitest'
import { buildControllerOptions } from './controllerOptions.ts'
import type { ZUINode } from '../../api/lib/ZwaveClient'
import { RFRegion } from 'zwave-js'

function node(overrides: Partial<ZUINode> = {}): ZUINode {
	return {
		id: 1,
		isControllerNode: true,
		ready: true,
		available: true,
		failed: false,
		inited: true,
		eventsQueue: [],
		RFRegion: RFRegion['USA (Long Range)'],
		rfRegions: [
			{ title: 'Europe', value: RFRegion.Europe },
			{ title: 'USA', value: RFRegion.USA },
			{ title: 'USA (Long Range)', value: RFRegion['USA (Long Range)'] },
			{
				title: 'Unknown',
				value: RFRegion.Unknown,
				disabled: true,
			} as { title: string; value: number; disabled: boolean },
		],
		powerlevel: -1,
		measured0dBm: 0.3,
		supportsLongRange: true,
		maxLongRangePowerlevel: 14,
		...overrides,
	} as unknown as ZUINode
}

describe('buildControllerOptions', () => {
	it('returns empty array for null node', () => {
		expect(buildControllerOptions(null)).toEqual([])
		expect(buildControllerOptions(undefined)).toEqual([])
	})

	it('produces all four options for a Long Range controller', () => {
		const opts = buildControllerOptions(node())
		expect(opts).toHaveLength(4)
		expect(opts.map((o) => o.key)).toEqual([
			'rfRegion',
			'powerlevel',
			'measured0dBm',
			'maxLRPowerlevel',
		])
	})

	it('omits maxLRPowerlevel when supportsLongRange is false', () => {
		const opts = buildControllerOptions(node({ supportsLongRange: false }))
		expect(opts.map((o) => o.key)).not.toContain('maxLRPowerlevel')
	})

	describe('RF Region', () => {
		it('filters out disabled regions', () => {
			const opts = buildControllerOptions(node())
			const rf = opts.find((o) => o.key === 'rfRegion')
			const values = rf.options.map((o) => o.value)
			expect(values).not.toContain(RFRegion.Unknown)
		})

		it('renders as readonly when RFRegion is undefined', () => {
			const opts = buildControllerOptions(node({ RFRegion: undefined }))
			const rf = opts.find((o) => o.key === 'rfRegion')
			expect(rf.kind).toBe('readonly')
			expect(rf.display).toBe('—')
			expect(rf.options).toBeUndefined()
		})
	})

	describe('power levels with auto-powerlevel enabled', () => {
		it('makes powerlevel readonly for USA region', () => {
			const opts = buildControllerOptions(node(), {
				autoPowerlevels: true,
			})
			const pl = opts.find((o) => o.key === 'powerlevel')
			expect(pl.kind).toBe('readonly')
			expect(pl.description).toContain('Automatic mode')
		})

		it('makes maxLRPowerlevel readonly for USA region', () => {
			const opts = buildControllerOptions(node(), {
				autoPowerlevels: true,
			})
			const lr = opts.find((o) => o.key === 'maxLRPowerlevel')
			expect(lr.kind).toBe('readonly')
		})
	})

	describe('power levels with auto-powerlevel disabled', () => {
		it('makes powerlevel editable', () => {
			const opts = buildControllerOptions(node(), {
				autoPowerlevels: false,
			})
			const pl = opts.find((o) => o.key === 'powerlevel')
			expect(pl.kind).toBe('number')
			expect(pl.description).toBeUndefined()
		})

		it('makes maxLRPowerlevel an enum with two options', () => {
			const opts = buildControllerOptions(node(), {
				autoPowerlevels: false,
			})
			const lr = opts.find((o) => o.key === 'maxLRPowerlevel')
			expect(lr.kind).toBe('enum')
			expect(lr.options).toHaveLength(2)
			expect(lr.options.map((o) => o.value)).toEqual([14, 20])
		})
	})

	describe('power levels for non-auto-eligible regions', () => {
		it('makes powerlevel editable even with autoPowerlevels=true', () => {
			const opts = buildControllerOptions(
				node({ RFRegion: RFRegion.India }),
				{ autoPowerlevels: true },
			)
			const pl = opts.find((o) => o.key === 'powerlevel')
			expect(pl.kind).toBe('number')
		})
	})

	it('uses step 0.1 for measured0dBm', () => {
		const opts = buildControllerOptions(node())
		const m = opts.find((o) => o.key === 'measured0dBm')
		expect(m.step).toBe(0.1)
	})
})
