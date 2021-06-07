import { ColumnFilterHelper } from './ColumnFilterHelper'

describe('ColumnFilterHelper', () => {
	describe('#defaultFilter', () => {
		test('returns the default filter for the given column type', () => {
			expect(ColumnFilterHelper.defaultFilter('boolean')).toEqual({
				boolValue: null,
			})
			expect(ColumnFilterHelper.defaultFilter('date')).toEqual({
				from: null,
				to: null,
			})
			expect(ColumnFilterHelper.defaultFilter('number')).toEqual({
				min: null,
				max: null,
				values: [],
			})
			expect(ColumnFilterHelper.defaultFilter('string')).toEqual({
				match: '',
				values: [],
			})
		})
	})

	describe('#filterProps', () => {
		test('returns the list of filter props for the given column type', () => {
			expect(ColumnFilterHelper.filterProps('boolean')).toEqual([
				'boolValue',
			])
			expect(ColumnFilterHelper.filterProps('date')).toEqual([
				'from',
				'to',
			])
			expect(ColumnFilterHelper.filterProps('number')).toEqual([
				'min',
				'max',
				'values',
			])
			expect(ColumnFilterHelper.filterProps('string')).toEqual([
				'match',
				'values',
			])
		})
	})
})
