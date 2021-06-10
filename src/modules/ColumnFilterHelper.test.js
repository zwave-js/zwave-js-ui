import { expect } from 'chai'
import { ColumnFilterHelper } from './ColumnFilterHelper'

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
})
