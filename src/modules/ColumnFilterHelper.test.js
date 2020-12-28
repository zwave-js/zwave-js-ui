import chai from 'chai'
import { ColumnFilterHelper } from './ColumnFilterHelper'

describe('ColumnFilterHelper', () => {
  describe('#defaultFilter', () => {
    it('returns the default filter for the given column type', () => {
      chai
        .expect(ColumnFilterHelper.defaultFilter('boolean'))
        .to.eql({ boolValue: null })
      chai
        .expect(ColumnFilterHelper.defaultFilter('date'))
        .to.eql({ from: null, to: null })
      chai
        .expect(ColumnFilterHelper.defaultFilter('number'))
        .to.eql({ min: null, max: null, values: [] })
      chai
        .expect(ColumnFilterHelper.defaultFilter('string'))
        .to.eql({ match: '', values: [] })
    })
  })

  describe('#filterProps', () => {
    it('returns the list of filter props for the given column type', () => {
      chai
        .expect(ColumnFilterHelper.filterProps('boolean'))
        .to.eql(['boolValue'])
      chai.expect(ColumnFilterHelper.filterProps('date')).to.eql(['from', 'to'])
      chai
        .expect(ColumnFilterHelper.filterProps('number'))
        .to.eql(['min', 'max', 'values'])
      chai
        .expect(ColumnFilterHelper.filterProps('string'))
        .to.eql(['match', 'values'])
    })
  })
})
