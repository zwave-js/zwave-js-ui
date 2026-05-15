import { expect } from 'chai'
import {
	getImportedNodeLocation,
	normalizeImportedNodesConfig,
} from '../../api/lib/importConfig.ts'

describe('importConfig', () => {
	describe('#normalizeImportedNodesConfig()', () => {
		it('keeps direct node map format', () => {
			const config = {
				1: { name: 'Kitchen', loc: 'First Floor' },
				3: { name: 'Office' },
			}

			expect(normalizeImportedNodesConfig(config)).to.deep.equal(config)
		})

		it('unwraps home id wrapped node map format', () => {
			const config = {
				'0xd6aa1f93': {
					1: { name: 'Kitchen', loc: 'First Floor' },
					3: { name: 'Office', loc: 'Second Floor' },
				},
			}

			expect(normalizeImportedNodesConfig(config)).to.deep.equal({
				1: { name: 'Kitchen', loc: 'First Floor' },
				3: { name: 'Office', loc: 'Second Floor' },
			})
		})

		it('unwraps and merges multiple home id wrappers', () => {
			const config = {
				'0xd6aa1f93': {
					1: { name: 'Kitchen', loc: 'First Floor' },
				},
				'0xaaaaaaaa': {
					3: { name: 'Office', loc: 'Second Floor' },
				},
			}

			expect(normalizeImportedNodesConfig(config)).to.deep.equal({
				1: { name: 'Kitchen', loc: 'First Floor' },
				3: { name: 'Office', loc: 'Second Floor' },
			})
		})

		it('uses id when importing node arrays', () => {
			const config = [
				{ id: 3, name: 'Node 3', loc: 'Kitchen' },
				{ id: 5, name: 'Node 5', loc: 'Office' },
			]

			expect(normalizeImportedNodesConfig(config)).to.deep.equal({
				3: { id: 3, name: 'Node 3', loc: 'Kitchen' },
				5: { id: 5, name: 'Node 5', loc: 'Office' },
			})
		})

		it('falls back to 1-based array index when id is missing', () => {
			const config = [
				{ name: 'Node 1', loc: 'Kitchen' },
				{ name: 'Node 2', loc: 'Office' },
			]

			expect(normalizeImportedNodesConfig(config)).to.deep.equal({
				1: { name: 'Node 1', loc: 'Kitchen' },
				2: { name: 'Node 2', loc: 'Office' },
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
