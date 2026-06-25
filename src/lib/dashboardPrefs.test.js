// Preferences persistence tests.

import { expect } from 'chai'

class LocalStorageMock {
	constructor() {
		this.items = {}
	}
	getItem(k) {
		return this.items[k]
	}
	setItem(k, v) {
		this.items[k] = v
	}
}

// Reload the module per-test so the module-scoped `settings` instance
// picks up the freshly-mocked localStorage.
async function freshModule() {
	const url = new URL('./dashboardPrefs.ts', import.meta.url).href
	return await import(`${url}?t=${Date.now()}_${Math.random()}`)
}

describe('dashboardPrefs', () => {
	let prevStorage
	beforeEach(() => {
		prevStorage = global.localStorage
		global.localStorage = new LocalStorageMock()
	})
	afterEach(() => {
		global.localStorage = prevStorage
	})

	it('returns defaults when nothing is stored', async () => {
		const m = await freshModule()
		const p = m.load()
		expect(p.scope).to.equal('overview')
		expect(p.grouping).to.equal('location')
		expect(p.view).to.equal('cards')
		expect(p.sort).to.deep.equal({ key: 'id', dir: 'asc' })
		expect(p.visibleCols).to.include('activity')
		expect(p.collapsedGroups).to.deep.equal([])
		expect(p.activityHidden).to.equal(false)
	})

	it('round-trips a saved blob', async () => {
		const m = await freshModule()
		m.save({
			scope: 'attention',
			grouping: 'type',
			view: 'table',
			sort: { key: 'location', dir: 'desc' },
			visibleCols: ['location'],
			collapsedGroups: ['Kitchen'],
			activityHidden: true,
		})
		const p = m.load()
		expect(p.scope).to.equal('attention')
		expect(p.grouping).to.equal('type')
		expect(p.view).to.equal('table')
		expect(p.sort).to.deep.equal({ key: 'location', dir: 'desc' })
		expect(p.visibleCols).to.deep.equal(['location'])
		expect(p.collapsedGroups).to.deep.equal(['Kitchen'])
		expect(p.activityHidden).to.equal(true)
	})

	it('falls back per-field on invalid values (does not reset the whole blob)', async () => {
		const m = await freshModule()
		// Write a mostly-valid blob with one invalid field (scope).
		m.save({
			scope: 'attention',
			grouping: 'type',
			view: 'table',
			sort: { key: 'id', dir: 'asc' },
			visibleCols: ['location'],
			collapsedGroups: [],
			activityHidden: false,
		})
		// Corrupt the scope only.
		const raw = JSON.parse(global.localStorage.getItem('dashboard'))
		raw.scope = 'bogus'
		global.localStorage.setItem('dashboard', JSON.stringify(raw))

		const p = m.load()
		expect(p.scope).to.equal('overview') // fell back to default
		expect(p.grouping).to.equal('type') // unchanged
		expect(p.view).to.equal('table')
	})

	it('resets to defaults on empty storage even after corruption', async () => {
		const m = await freshModule()
		global.localStorage.setItem('dashboard', 'not json at all')
		const p = m.load()
		expect(p.scope).to.equal('overview')
	})
})
