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

const testItems = [
  { id: 1, name: 'a', value: 'Abc' },
  { id: 2, name: 'b', value: 'Xyz' },
  { id: 3, name: 'a', value: 'Abc' },
  { id: 4, name: 'c', value: 'Xyz' },
  { id: 5, name: 'b', value: 'Abc' },
  { id: 6, name: 'a', value: 'Xyz' }
]
const testItemHeaders = [
  { value: 'id', text: 'ID', type: 'number', groupable: false },
  { value: 'name', text: 'Name', type: 'string', groupable: true },
  { value: 'value', text: 'Value', type: 'string', groupable: true }
]
const testPropDefs = {
  id: { type: 'number', label: 'ID', groupable: false },
  name: { type: 'string', label: 'Name' },
  value: { type: 'string', label: 'Value' }
}
function getNewManagedTestItems () {
  return new ManagedItems(
    testItems,
    testPropDefs,
    new LocalStorageMock(),
    'test_'
  )
}

describe('ManagedItems', () => {
  describe('#constructor', () => {
    it('returns an initialized object', () => {
      const managedItems = getNewManagedTestItems()
      chai.expect(Object.keys(managedItems).length).to.be.at.least(1)
    })
  })
  describe('#reset', () => {
    it('resets the filters', () => {
      const managedItems = getNewManagedTestItems()
      managedItems.filters = { name: { matches: 'b' } }
      managedItems.reset()
      chai.expect(managedItems.filteredItems.length).to.eql(testItems.length)
    })
    it('resets the grouping', () => {
      const managedItems = getNewManagedTestItems()
      managedItems.groupBy = ['value']
      managedItems.reset()
      chai.expect(managedItems.groupBy).to.eql([])
    })
    it('resets the selections', () => {
      const managedItems = getNewManagedTestItems()
      managedItems.selected = [testItems[0], testItems[2]]
      managedItems.reset()
      chai.expect(managedItems.selected).to.eql([])
    })
    it('resets the table columns', () => {
      const managedItems = getNewManagedTestItems()
      managedItems.tableColumns = ['id', 'value']
      managedItems.reset()
      chai.expect(managedItems.tableHeaders).to.eql(testItemHeaders)
    })
    it('resets the table items per page', () => {
      const managedItems = getNewManagedTestItems()
      managedItems.tableOptions.itemsPerPage = 100
      managedItems.reset()
      chai.expect(managedItems.tableOptions.itemsPerPage).to.eql(10)
    })
    it('resets the table page', () => {
      const managedItems = getNewManagedTestItems()
      managedItems.tableOptions.itemsPerPage = 100
      managedItems.reset()
      chai.expect(managedItems.tableOptions.itemsPerPage).to.eql(10)
    })
    it('resets the table sorting', () => {
      const managedItems = getNewManagedTestItems()
      managedItems.tableOptions.sortBy = ['value']
      managedItems.tableOptions.sortDesc = [true]
      managedItems.reset()
      chai.expect(managedItems.tableOptions.sortBy).to.eql(['id'])
      chai.expect(managedItems.tableOptions.sortDesc).to.eql([false])
    })
  })
  describe('#setFilterToSelected', () => {
    it('filters by selected items (filter was empty)', () => {
      const managedItems = getNewManagedTestItems()
      // Ensure pre-conditions:
      chai.expect(managedItems.selected).to.be.eql([])
      chai
        .expect(managedItems.filteredItems.length)
        .to.be.eql(managedItems.items.length)
      const itemsToBeSelected = [{ id: 1 }, { id: 3 }]
      managedItems.selected = itemsToBeSelected
      chai.expect(managedItems.selected).to.eql(itemsToBeSelected)
      // Execute function to be tested:
      managedItems.setFilterToSelected()
      // Ensure post-conditions:
      chai
        .expect(managedItems.filteredItems.length)
        .to.eql(itemsToBeSelected.length)
      chai
        .expect(managedItems.filteredItems[0].id)
        .to.eql(itemsToBeSelected[0].id)
      chai
        .expect(managedItems.filteredItems[1].id)
        .to.eql(itemsToBeSelected[1].id)
    })
  })
  describe('#getPropValues', () => {
    it('returns a sorted list of unique values for a property', () => {
      const managedItems = getNewManagedTestItems()
      chai.expect(managedItems.getPropValues('name')).to.eql(['a', 'b', 'c'])
    })
  })
  describe('#propValues', () => {
    it('returns a sorted list of unique values for each property', () => {
      const managedItems = getNewManagedTestItems()
      chai.expect(managedItems.propValues).to.eql({
        id: [1, 2, 3, 4, 5, 6],
        name: ['a', 'b', 'c'],
        value: ['Abc', 'Xyz']
      })
    })
  })
  describe('#filteredItems', () => {
    it('returns the filtered items', () => {
      const managedItems = getNewManagedTestItems()
      chai.expect(managedItems.filteredItems.length).to.eql(testItems.length)
      managedItems.filters = { name: { match: 'b' } }
      chai.expect(managedItems.filteredItems.length).to.eql(2)
      chai.expect(managedItems.filteredItems[0].id).to.eql(2)
      chai.expect(managedItems.filteredItems[1].id).to.eql(5)
    })
  })
  describe('#allTableHeaders', () => {
    it('returns table headers using defaults', () => {
      const managedItems = new ManagedItems(
        testItems,
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
      const managedItems = getNewManagedTestItems()
      chai.expect(managedItems.allTableHeaders).to.eql(testItemHeaders)
    })
  })
  describe('#tableHeaders', () => {
    it('returns the active table headers', () => {
      const managedItems = getNewManagedTestItems()
      managedItems.tableColumns = ['id', 'value']
      chai.expect(managedItems.tableHeaders).to.eql([
        { value: 'id', text: 'ID', type: 'number', groupable: false },
        { value: 'value', text: 'Value', type: 'string', groupable: true }
      ])
    })
  })
  describe('#groupByTitle', () => {
    it('returns the group by title from the propDef name by default', () => {
      const managedItems = new ManagedItems(
        testItems,
        { id: {} },
        new LocalStorageMock(),
        'test_'
      )
      managedItems.groupBy = ['value']
      chai.expect(managedItems.groupByTitle).to.eql('value')
    })
    it('returns the group by title from a given propDef label', () => {
      const managedItems = getNewManagedTestItems()
      managedItems.groupBy = ['value']
      chai.expect(managedItems.groupByTitle).to.eql('Value')
    })
  })
})
