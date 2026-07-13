import { describe, it, expect } from 'vitest'
import {
	getImportedNodeLocation,
	normalizeImportedNodesConfig,
} from '#api/lib/importConfig'

describe('importConfig', () => {
	describe('#normalizeImportedNodesConfig()', () => {
		it('keeps direct node map format', () => {
			const config = {
				1: { name: 'Kitchen', loc: 'First Floor' },
				3: { name: 'Office' },
			}

			expect(normalizeImportedNodesConfig(config)).to.deep.equal({
				nodes: config,
				skippedHomeIds: [],
			})
		})

		it('unwraps a single home id wrapped node map regardless of homeHex', () => {
			const config = {
				'0xd6aa1f93': {
					1: { name: 'Kitchen', loc: 'First Floor' },
					3: { name: 'Office', loc: 'Second Floor' },
				},
			}

			expect(normalizeImportedNodesConfig(config)).to.deep.equal({
				nodes: {
					1: { name: 'Kitchen', loc: 'First Floor' },
					3: { name: 'Office', loc: 'Second Floor' },
				},
				selectedHomeId: '0xd6aa1f93',
				skippedHomeIds: [],
			})
		})

		it('selects the entry matching the current controller home id', () => {
			const config = {
				'0xd6aa1f93': {
					1: { name: 'Kitchen', loc: 'First Floor' },
				},
				'0xaaaaaaaa': {
					3: { name: 'Office', loc: 'Second Floor' },
				},
			}

			expect(
				normalizeImportedNodesConfig(config, '0xaaaaaaaa'),
			).to.deep.equal({
				nodes: { 3: { name: 'Office', loc: 'Second Floor' } },
				selectedHomeId: '0xaaaaaaaa',
				skippedHomeIds: ['0xd6aa1f93'],
			})
		})

		it('honors an explicit home id selection over the controller match', () => {
			const config = {
				'0xd6aa1f93': {
					1: { name: 'Kitchen', loc: 'First Floor' },
				},
				'0xaaaaaaaa': {
					3: { name: 'Office', loc: 'Second Floor' },
				},
			}

			expect(
				normalizeImportedNodesConfig(config, '0xd6aa1f93', {
					homeId: '0xaaaaaaaa',
				}),
			).to.deep.equal({
				nodes: { 3: { name: 'Office', loc: 'Second Floor' } },
				selectedHomeId: '0xaaaaaaaa',
				skippedHomeIds: ['0xd6aa1f93'],
			})
		})

		it('merges all home ids when mergeAll is set', () => {
			const config = {
				'0xd6aa1f93': {
					1: { name: 'Kitchen', loc: 'First Floor' },
				},
				'0xaaaaaaaa': {
					3: { name: 'Office', loc: 'Second Floor' },
				},
			}

			expect(
				normalizeImportedNodesConfig(config, '0xbbbbbbbb', {
					mergeAll: true,
				}),
			).to.deep.equal({
				nodes: {
					1: { name: 'Kitchen', loc: 'First Floor' },
					3: { name: 'Office', loc: 'Second Floor' },
				},
				skippedHomeIds: [],
			})
		})

		it('skips all home ids when multiple are present and none match', () => {
			const config = {
				'0xd6aa1f93': {
					1: { name: 'Kitchen', loc: 'First Floor' },
				},
				'0xaaaaaaaa': {
					3: { name: 'Office', loc: 'Second Floor' },
				},
			}

			expect(
				normalizeImportedNodesConfig(config, '0xbbbbbbbb'),
			).to.deep.equal({
				nodes: {},
				skippedHomeIds: ['0xd6aa1f93', '0xaaaaaaaa'],
			})
		})

		it('uses id when importing node arrays', () => {
			const config = [
				{ id: 3, name: 'Node 3', loc: 'Kitchen' },
				{ id: 5, name: 'Node 5', loc: 'Office' },
			]

			expect(normalizeImportedNodesConfig(config)).to.deep.equal({
				nodes: {
					3: { id: 3, name: 'Node 3', loc: 'Kitchen' },
					5: { id: 5, name: 'Node 5', loc: 'Office' },
				},
				skippedHomeIds: [],
			})
		})

		it('falls back to 1-based array index when id is missing', () => {
			const config = [
				{ name: 'Node 1', loc: 'Kitchen' },
				{ name: 'Node 2', loc: 'Office' },
			]

			expect(normalizeImportedNodesConfig(config)).to.deep.equal({
				nodes: {
					1: { name: 'Node 1', loc: 'Kitchen' },
					2: { name: 'Node 2', loc: 'Office' },
				},
				skippedHomeIds: [],
			})
		})

		it('uses legacy array index format when index 0 is empty', () => {
			const config = [
				null,
				{ name: 'Node 1', loc: 'Kitchen' },
				{ name: 'Node 2', loc: 'Office' },
			]

			expect(normalizeImportedNodesConfig(config)).to.deep.equal({
				nodes: {
					1: { name: 'Node 1', loc: 'Kitchen' },
					2: { name: 'Node 2', loc: 'Office' },
				},
				skippedHomeIds: [],
			})
		})
	})

	describe('#getImportedNodeLocation()', () => {
		it('reads loc first', () => {
			expect(
				getImportedNodeLocation({
					loc: 'Kitchen',
					location: 'Ignored',
				}),
			).to.equal('Kitchen')
		})

		it('falls back to location', () => {
			expect(getImportedNodeLocation({ location: 'Hallway' })).to.equal(
				'Hallway',
			)
		})
	})
})
