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
    test('returns an initialized object', () => {
      const managedItems = getNewManagedTestItems()
      expect(Object.keys(managedItems).length).toBeGreaterThanOrEqual(1)
    })
  })
  describe('#reset', () => {
    test('resets the filters', () => {
      const managedItems = getNewManagedTestItems()
      managedItems.filters = { name: { matches: 'b' } }
      managedItems.reset()
      expect(managedItems.filteredItems.length).toEqual(testItems.length)
    })
    test('resets the grouping', () => {
      const managedItems = getNewManagedTestItems()
      managedItems.groupBy = ['value']
      managedItems.reset()
      expect(managedItems.groupBy).toEqual([])
    })
    test('resets the selections', () => {
      const managedItems = getNewManagedTestItems()
      managedItems.selected = [testItems[0], testItems[2]]
      managedItems.reset()
      expect(managedItems.selected).toEqual([])
    })
    test('resets the table columns', () => {
      const managedItems = getNewManagedTestItems()
      managedItems.tableColumns = ['id', 'value']
      managedItems.reset()
      expect(managedItems.tableHeaders).toEqual(testItemHeaders)
    })
    test('resets the table items per page', () => {
      const managedItems = getNewManagedTestItems()
      managedItems.tableOptions.itemsPerPage = 100
      managedItems.reset()
      expect(managedItems.tableOptions.itemsPerPage).toEqual(10)
    })
    test('resets the table page', () => {
      const managedItems = getNewManagedTestItems()
      managedItems.tableOptions.itemsPerPage = 100
      managedItems.reset()
      expect(managedItems.tableOptions.itemsPerPage).toEqual(10)
    })
    test('resets the table sorting', () => {
      const managedItems = getNewManagedTestItems()
      managedItems.tableOptions.sortBy = ['value']
      managedItems.tableOptions.sortDesc = [true]
      managedItems.reset()
      expect(managedItems.tableOptions.sortBy).toEqual(['id'])
      expect(managedItems.tableOptions.sortDesc).toEqual([false])
    })
  })
  describe('#setFilterToSelected', () => {
    test('filters by selected items (filter was empty)', () => {
      const managedItems = getNewManagedTestItems()
      // Ensure pre-conditions:
      expect(managedItems.selected).toEqual([])
      expect(managedItems.filteredItems.length)
        .toEqual(managedItems.items.length)
      const itemsToBeSelected = [{ id: 1 }, { id: 3 }]
      managedItems.selected = itemsToBeSelected
      expect(managedItems.selected).toEqual(itemsToBeSelected)
      // Execute function to be tested:
      managedItems.setFilterToSelected()
      // Ensure post-conditions:
      expect(managedItems.filteredItems.length)
        .toEqual(itemsToBeSelected.length)
      expect(managedItems.filteredItems[0].id)
        .toEqual(itemsToBeSelected[0].id)
      expect(managedItems.filteredItems[1].id)
        .toEqual(itemsToBeSelected[1].id)
    })
  })
  describe('#getPropValues', () => {
    test('returns a sorted list of unique values for a property', () => {
      const managedItems = getNewManagedTestItems()
      expect(managedItems.getPropValues('name')).toEqual(['a', 'b', 'c'])
    })
  })
  describe('#propValues', () => {
    test('returns a sorted list of unique values for each property', () => {
      const managedItems = getNewManagedTestItems()
      expect(managedItems.propValues).toEqual({
        id: [1, 2, 3, 4, 5, 6],
        name: ['a', 'b', 'c'],
        value: ['Abc', 'Xyz']
      })
    })
  })
  describe('#filteredItems', () => {
    test('returns the filtered items', () => {
      const managedItems = getNewManagedTestItems()
      expect(managedItems.filteredItems.length).toEqual(testItems.length)
      managedItems.filters = { name: { match: 'b' } }
      expect(managedItems.filteredItems.length).toEqual(2)
      expect(managedItems.filteredItems[0].id).toEqual(2)
      expect(managedItems.filteredItems[1].id).toEqual(5)
    })
  })
  describe('#allTableHeaders', () => {
    test('returns table headers using defaults', () => {
      const managedItems = new ManagedItems(
        testItems,
        { id: {} },
        new LocalStorageMock(),
        'test_'
      )
      expect(managedItems.allTableHeaders)
        .toEqual([
          { text: 'id', type: 'string', value: 'id', groupable: true }
        ])
    })
    test('returns table headers using given values', () => {
      const managedItems = getNewManagedTestItems()
      expect(managedItems.allTableHeaders).toEqual(testItemHeaders)
    })
  })
  describe('#tableHeaders', () => {
    test('returns the active table headers', () => {
      const managedItems = getNewManagedTestItems()
      managedItems.tableColumns = [
        { name: 'id', visible: true },
        { name: 'value', visible: true },
        { name: 'info', visible: false }
      ]
      expect(managedItems.tableHeaders).toEqual([
        { value: 'id', text: 'ID', type: 'number', groupable: false },
        { value: 'value', text: 'Value', type: 'string', groupable: true }
      ])
    })
  })
  describe('#groupByTitle', () => {
    test('returns the group by title from the propDef name by default', () => {
      const managedItems = new ManagedItems(
        testItems,
        { id: {} },
        new LocalStorageMock(),
        'test_'
      )
      managedItems.groupBy = ['value']
      expect(managedItems.groupByTitle).toEqual('value')
    })
    test('returns the group by title from a given propDef label', () => {
      const managedItems = getNewManagedTestItems()
      managedItems.groupBy = ['value']
      expect(managedItems.groupByTitle).toEqual('Value')
    })
  })
})
