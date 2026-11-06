import { describe, it, expect } from 'vitest'
import { ColumnFilterHelper } from './ColumnFilterHelper.js'
import { NodeCollection } from './NodeCollection.js'

describe('ColumnFilterHelper', () => {
	describe('#defaultFilter', () => {
		it('returns the default filter for the given column type', () => {
			expect(ColumnFilterHelper.defaultFilter('boolean')).to.eql({
				boolValue: null,
			})
			expect(ColumnFilterHelper.defaultFilter('date')).to.eql({
				from: null,
				to: null,
			})
			expect(ColumnFilterHelper.defaultFilter('number')).to.eql({
				min: null,
				max: null,
				values: [],
			})
			expect(ColumnFilterHelper.defaultFilter('string')).to.eql({
				match: '',
				values: [],
			})
		})
	})

	describe('#filterProps', () => {
		it('returns the list of filter props for the given column type', () => {
			expect(ColumnFilterHelper.filterProps('boolean')).to.eql([
				'boolValue',
			])
			expect(ColumnFilterHelper.filterProps('date')).to.eql([
				'from',
				'to',
			])
			expect(ColumnFilterHelper.filterProps('number')).to.eql([
				'min',
				'max',
				'values',
			])
			expect(ColumnFilterHelper.filterProps('string')).to.eql([
				'match',
				'values',
			])
		})
	})

	describe('#isFilterActive', () => {
		it('is false for missing, default and emptied filters', () => {
			expect(
				ColumnFilterHelper.isFilterActive('string', undefined),
			).to.equal(false)
			for (const type of ['boolean', 'date', 'number', 'string']) {
				expect(
					ColumnFilterHelper.isFilterActive(
						type,
						ColumnFilterHelper.defaultFilter(type),
					),
				).to.equal(false)
			}
			expect(ColumnFilterHelper.isFilterActive('string', {})).to.equal(
				false,
			)
		})

		it('is true for any set value, falsy ones included', () => {
			expect(
				ColumnFilterHelper.isFilterActive('boolean', {
					boolValue: false,
				}),
			).to.equal(true)
			expect(
				ColumnFilterHelper.isFilterActive('number', { min: 0 }),
			).to.equal(true)
			expect(
				ColumnFilterHelper.isFilterActive('string', { values: ['a'] }),
			).to.equal(true)
			expect(
				ColumnFilterHelper.isFilterActive('date', {
					from: new Date(0),
				}),
			).to.equal(true)
		})

		it('is false for column types without filters', () => {
			expect(
				ColumnFilterHelper.isFilterActive('custom', { a: 1 }),
			).to.equal(false)
		})
	})

	describe('#filterByFilterSpec', () => {
		const headers = [
			{ key: 'name', type: 'string' },
			{ key: 'id', type: 'number' },
		]
		const nodes = [
			{ id: 1, name: 'a' },
			{ id: 2, name: 'b' },
		]
		const filter = (filters: Record<string, any>) =>
			ColumnFilterHelper.filterByFilterSpec(
				new NodeCollection(nodes),
				headers,
				filters,
			).nodes

		it('returns every node when no filter is set', () => {
			expect(
				filter({ name: { match: '', values: [] }, id: { min: null } }),
			).to.eql(nodes)
		})

		it('applies only the set filters', () => {
			expect(filter({ name: { match: '' }, id: { min: 2 } })).to.eql([
				nodes[1],
			])
		})
	})
})
