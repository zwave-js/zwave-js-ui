import chai from 'chai'
import { ManagedItems } from '../modules/ManagedItems.js'

class LocalStorageMock {
  constructor () {
    this.items = {}
    this.isMocked = true
  }

  getItem (key) {
    return this.items[key]
  }

  setItem (key, val) {
    this.items[key] = val
  }
}

describe('ManagedItems', () => {
  describe('#constructor', () => {
    it('returns a non-empty object', () => {
      const managedItems = new ManagedItems(
        [{ id: 1 }],
        { id: {} },
        new LocalStorageMock(),
        'test_'
      )
      chai.expect(Object.keys(managedItems).length).to.be.at.least(1)
    })
  })
  describe('#getAllTableHeaders', () => {
    it('returns table headers using defaults', () => {
      const managedItems = new ManagedItems(
        [{ id: 1 }],
        { id: {} },
        new LocalStorageMock(),
        'test_'
      )
      chai
        .expect(managedItems.allTableHeaders)
        .to.be.eql([
          { text: 'id', type: 'string', value: 'id', groupable: true }
        ])
    })
    it('returns table headers using given values', () => {
      const managedItems = new ManagedItems(
        [{ id: 1 }],
        { id: { type: 'number', label: 'ID', groupable: false } },
        new LocalStorageMock(),
        'test_'
      )
      chai
        .expect(managedItems.allTableHeaders)
        .to.be.eql([
          { text: 'ID', type: 'number', value: 'id', groupable: false }
        ])
    })
  })
  describe('#filterSelected', () => {
    it('filters by selected items (filter was empty)', () => {
      // TODO: Continue here ...
      const managedItems = new ManagedItems(
        [{ id: 1 }, { id: 2 }],
        { id: {} },
        new LocalStorageMock(),
        'test_'
      )
      chai.expect(managedItems.selected).to.be.eql([])
      chai.expect(managedItems.filteredItems.length).to.be.eql(2)
      managedItems.selected = [{ id: 2 }]
      chai.expect(managedItems.selected).to.be.eql([{ id: 2 }])
      managedItems.filterSelected()
      chai.expect(managedItems.filteredItems.length).to.be.eql(1)
    })
  })
  describe('#getPropValues', () => {
    it('returns a sorted list of unique values for a property', () => {
      const managedItems = new ManagedItems(
        [
          { name: 'a' },
          { name: 'b' },
          { name: 'a' },
          { name: 'c' },
          { name: 'b' },
          { name: 'a' }
        ],
        { name: {} },
        new LocalStorageMock(),
        'test_'
      )
      chai.expect(managedItems.getPropValues('name')).to.eql(['a', 'b', 'c'])
    })
  })
})
