// Filter pipeline tests.

import { describe, it, expect } from 'vitest'
import type { Component } from 'vue'
import type { Device } from './dashboard-types'
import {
	applyScope,
	applySearch,
	buildGroups,
	compareDevices,
	groupBy,
	nextSort,
} from './deviceFilter.ts'

function mk(o: any): Device {
	return {
		nodeId: o.id,
		isController: !!o.isController,
		name: o.name ?? `Node ${o.id}`,
		location: o.location ?? '',
		manufacturer: o.manufacturer ?? '',
		product: o.product ?? '',
		archetype: {
			kind: o.kind ?? 'switch',
			label: o.label ?? 'Switch',
			icon: null as unknown as Component,
			power: 'mains',
		},
		power: o.power ?? { type: 'mains' },
		status: o.status ?? 'alive',
		interviewState: o.interviewState ?? 'complete',
		securityKeys: [],
		lastSeen: 'now',
		primaryValue: null,
		activity: o.activity ?? [],
		hasUpdate: !!o.hasUpdate,
	}
}

const CONTROLLER = mk({ id: 1, isController: true, location: '' })
const SWITCH_A = mk({ id: 2, name: 'Kitchen Switch', location: 'Kitchen' })
const SWITCH_B = mk({ id: 3, name: 'Bedroom Switch', location: 'Bedroom' })
const DEAD = mk({ id: 4, status: 'dead', location: 'Attic' })
const RUNNING = mk({
	id: 5,
	location: 'Office',
	activity: [{ type: 'ota', label: 'OTA', progress: 40 }],
})

describe('applyScope', () => {
	it('overview returns everything', () => {
		expect(
			applyScope([CONTROLLER, SWITCH_A, DEAD], 'overview'),
		).to.have.length(3)
	})
	it('attention keeps controller + dead', () => {
		const out = applyScope([CONTROLLER, SWITCH_A, DEAD], 'attention')
		expect(out).to.have.length(2)
		expect(out.map((d) => d.nodeId)).to.deep.equal([1, 4])
	})
	it('activity keeps only devices with activity', () => {
		const out = applyScope([CONTROLLER, SWITCH_A, RUNNING], 'activity')
		expect(out).to.have.length(1)
		expect(out[0].nodeId).to.equal(5)
	})
})

describe('applySearch', () => {
	it('case-insensitive substring match across fields', () => {
		expect(applySearch([SWITCH_A, SWITCH_B], 'kitchen')).to.have.length(1)
		expect(applySearch([SWITCH_A, SWITCH_B], 'BED')).to.have.length(1)
	})
	it('matches the stringified id', () => {
		expect(applySearch([SWITCH_A, SWITCH_B], '3')).to.have.length(1)
	})
	it('empty query returns the pool unchanged', () => {
		expect(applySearch([SWITCH_A, SWITCH_B], '')).to.have.length(2)
		expect(applySearch([SWITCH_A, SWITCH_B], '   ')).to.have.length(2)
	})
})

describe('groupBy', () => {
	it('groups by location with controller pinned', () => {
		const out = groupBy([SWITCH_B, CONTROLLER, SWITCH_A], 'location')
		expect(out[0][0]).to.equal('__controller')
		expect(out.map((e) => e[0])).to.include.members([
			'__controller',
			'Bedroom',
			'Kitchen',
		])
	})
	it('groups by type via archetype label', () => {
		const out = groupBy([SWITCH_A, SWITCH_B], 'type')
		expect(out).to.have.length(1)
		expect(out[0][0]).to.equal('Switch')
	})
	it('all returns a single bucket', () => {
		const out = groupBy([SWITCH_A, SWITCH_B], 'all')
		expect(out).to.have.length(1)
		expect(out[0][0]).to.equal('All devices')
	})
	it('buckets locationless devices under "No location"', () => {
		const homeless = mk({ id: 9, location: '' })
		const out = groupBy([homeless], 'location')
		expect(out[0][0]).to.equal('No location')
	})
})

describe('compareDevices', () => {
	it('pins controller to the top regardless of sort', () => {
		expect(
			compareDevices(CONTROLLER, SWITCH_A, { key: 'id', dir: 'asc' }),
		).to.be.below(0)
		expect(
			compareDevices(SWITCH_A, CONTROLLER, { key: 'id', dir: 'desc' }),
		).to.be.above(0)
	})
	it('sorts by id ascending by default', () => {
		expect(
			compareDevices(SWITCH_A, SWITCH_B, { key: 'id', dir: 'asc' }),
		).to.be.below(0)
	})
	it('sorts by location case-insensitive', () => {
		expect(
			compareDevices(SWITCH_A, SWITCH_B, { key: 'location', dir: 'asc' }),
		).to.be.above(0) // Kitchen > Bedroom
	})
	it('mains-first when sorting by power ascending', () => {
		const battery = mk({
			id: 6,
			power: { type: 'battery', battery: 50 },
		})
		expect(
			compareDevices(SWITCH_A, battery, { key: 'power', dir: 'asc' }),
		).to.be.below(0)
	})
})

describe('nextSort', () => {
	it('switching key starts ascending', () => {
		expect(nextSort({ key: 'id', dir: 'desc' }, 'location')).to.deep.equal({
			key: 'location',
			dir: 'asc',
		})
	})
	it('same key flips direction', () => {
		expect(nextSort({ key: 'id', dir: 'asc' }, 'id')).to.deep.equal({
			key: 'id',
			dir: 'desc',
		})
		expect(nextSort({ key: 'id', dir: 'desc' }, 'id')).to.deep.equal({
			key: 'id',
			dir: 'asc',
		})
	})
})

describe('buildGroups (full pipeline)', () => {
	const all = [CONTROLLER, SWITCH_A, SWITCH_B, DEAD, RUNNING]

	it('overview + location groups everyone', () => {
		const out = buildGroups(all, {
			scope: 'overview',
			grouping: 'location',
			query: '',
			sort: { key: 'id', dir: 'asc' },
		})
		expect(out[0][0]).to.equal('__controller')
		// Switches are sorted by id within each bucket.
		expect(
			out.flatMap(([, ds]) => ds.map((d) => d.nodeId)),
		).to.include.members([1, 2, 3, 4, 5])
	})

	it('attention scope narrows the pool', () => {
		const out = buildGroups(all, {
			scope: 'attention',
			grouping: 'all',
			query: '',
			sort: { key: 'id', dir: 'asc' },
		})
		expect(out[0][1].map((d) => d.nodeId)).to.have.members([1, 4])
	})

	it('location sort reorders groups by location asc/desc', () => {
		const asc = buildGroups(all, {
			scope: 'overview',
			grouping: 'location',
			query: '',
			sort: { key: 'location', dir: 'asc' },
		})
		const ascKeys = asc.map((e) => e[0])
		expect(ascKeys[0]).to.equal('__controller')
		const ascBuckets = ascKeys.filter((k) => k !== '__controller')
		const sorted = [...ascBuckets].sort()
		expect(ascBuckets).to.deep.equal(sorted)

		const desc = buildGroups(all, {
			scope: 'overview',
			grouping: 'location',
			query: '',
			sort: { key: 'location', dir: 'desc' },
		})
		const descBuckets = desc
			.map((e) => e[0])
			.filter((k) => k !== '__controller')
		expect(descBuckets).to.deep.equal([...descBuckets].sort().reverse())
	})
})
