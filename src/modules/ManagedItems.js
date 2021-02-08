import { NodeCollection } from './NodeCollection'
import { ColumnFilterHelper } from './ColumnFilterHelper'
import { Settings } from './Settings'

/**
 * Represents a collection of items that can be filtered, grouped, selected, sorted with persisted settings
 */
export class ManagedItems {
  /**
   *
   * @param {Array} items Items to be managed
   * @param {Object} propDefs Definition of item properties to be available for management
   * @param {String} storePrefix Use local storage to store the settings of managed properties with the given prefix
   */
  constructor (items, propDefs, store, storePrefix = 'items_') {
    this._items = items
    this.propDefs = propDefs
    this.settings = new Settings(store)
    this.doStore = !!storePrefix
    this.storePrefix = storePrefix || ''
    this.initialize()
  }

  /**
   * Load values from settings store or set to initial values
   */
  initialize () {
    this.tableOptions =
      this.tableOptions === undefined
        ? this.loadSetting('tableOptions', this.initialTableOptions)
        : this.tableOptions
    this.columns =
      this.columns === undefined
        ? this.loadSetting('columns', this.initialColumns)
        : this.columns
    this.filters =
      this.filters === undefined
        ? this.loadSetting('filters', this.initialFilters)
        : this.filters
    this.selected =
      this.selected === undefined
        ? this.loadSetting('selected', this.initialSelected)
        : this.selected
  }

  /**
   * Reset all settings
   */
  reset () {
    this.tableOptions = this.initialTableOptions
    this.columns = this.initialColumns
    this.filters = this.initialFilters
    this.selected = this.initialSelected
  }

  // Item handling

  /**
   * Get all managed items
   */
  get items () {
    return this._items
  }

  /**
   * Set managed items
   * @param {Array} items Items to be managed
   */
  set items (items) {
    this._items = items
  }

  /**
   * Get all property values from items
   */
  getPropValues (propName) {
    const uniqueMap = {}
    this.items.forEach(item => {
      const value = item[propName]
      if (value) {
        uniqueMap[value] = uniqueMap[value] || value
      }
    })
    return Object.keys(uniqueMap)
      .sort()
      .map(key => uniqueMap[key])
  }

  /**
   * Get values of all item properties
   */
  get propValues () {
    const values = {}
    Object.keys(this.propDefs).forEach(propName => {
      values[propName] = this.getPropValues(propName)
    })
    return values
  }

  /**
   * Get item collection for filtering
   */
  get itemCollection () {
    return new NodeCollection(this.items)
  }

  /**
   * Get filtered items
   */
  get filteredItems () {
    return ColumnFilterHelper.filterByFilterSpec(
      this.itemCollection,
      this.allTableHeaders,
      this.filters
    ).nodes // TODO: nodes should be items
  }

  // Setting storage methods

  /**
   * Load a key from the settings store
   * @param {String} key Key to be loaded from the settings store
   * @param {Any} defaultVal Default value if key is not in settings store
   */
  loadSetting (key, defaultVal) {
    return this.settings.load(this.storePrefix + key, defaultVal)
  }

  /**
   * Key/value to be stored to the settings store
   * @param {String} key Key to be stored
   * @param {Any} val Value to be stored
   */
  storeSetting (key, val) {
    if (this.doStore) {
      this.settings.store(this.storePrefix + key, val)
    }
  }

  // Table columns handling

  /**
   * Get all table column headers
   */
  get allTableHeaders () {
    const headers = []
    Object.keys(this.propDefs).forEach(key => {
      const propDef = this.propDefs[key]
      headers.push({
        value: key,
        text: propDef.label === undefined ? key : propDef.label,
        type: propDef.type === undefined ? 'string' : propDef.type,
        groupable: propDef.groupable === undefined ? true : !!propDef.groupable
      })
    })
    return headers
  }

  /**
   * Get visible table column headers
   */
  get tableHeaders () {
    return this.allTableHeaders.filter(col => this.columns.includes(col.value))
  }

  /**
   * Get initial table column list
   */
  get initialColumns () {
    return Object.keys(this.propDefs)
  }

  /**
   * Get the active table colum list
   */
  get columns () {
    return this._columns
  }

  /**
   * Set the list of active table columns
   * @param {Array} columns List of columns to be set
   */
  set columns (columns) {
    this._columns = columns
    this.storeSetting('columns', columns)
  }

  // Filters handling

  /**
   * Filter to selected items
   */
  setFilterToSelected() {
    this.setPropFilter('id', {
      values: this.selected.map(item => item.id)
    })
  }

  /**
   * Get initial filters
   */
  get initialFilters () {
    return this.allTableHeaders.reduce((values, h) => {
      values[h.value] = {}
      return values
    }, {})
  }

  /**
   * Get all filters
   */
  get filters () {
    return this._filters
  }

  /**
   * Set all filters
   * @param {Object} filters Filters to be set
   */
  set filters (filters) {
    this._filters = filters
    this.storeSetting('filters', filters)
  }

  /**
   * Get filter for property
   * @param {String} propName Property name
   */
  getPropFilter (propName) {
    return this.filters[propName]
  }

  /**
   * Set filter for property
   * @param {String} propName Property name
   * @param {Object} filterDef Filter definition
   */
  setPropFilter (propName, filterDef) {
    this.filters = this.filters ? this.filters : {}
    this.filters[propName] = filterDef
    this.storeSetting('filters', this.filters)
  }

  // GroupBy handling

  /**
   * Get table group by value
   */
  get groupBy () {
    return this.tableOptions.groupBy
  }

  /**
   * Set the table group by value
   * @param {Array} groupBy Group by value
   */
  set groupBy (groupBy) {
    this.tableOptions = Object.assign(this.tableOptions, { groupBy: groupBy })
  }

  /**
   * Get title for property group
   * @param {String} groupValue Property group value
   */
  get groupByTitle () {
    const propDef = this.propDefs[this.groupBy[0]]
    return propDef.label ? propDef.label : this.groupBy[0]
  }

  /**
   * Is the table grouped by given property?
   * @param {String} propName Property name
   */
  isGroupBy (propName) {
    return this.groupBy.includes(propName)
  }

  // Selection handling

  /**
   * Get initial selected items
   */
  get initialSelected () {
    return []
  }

  /**
   * Get selected items
   */
  get selected () {
    return this._selected
  }

  /**
   * Set selected items
   * @param {Array} selected List of selected items
   */
  set selected (selected) {
    this._selected = selected
  }

  // Table options handling

  /**
   * Get initial table options
   */
  get initialTableOptions () {
    return {
      page: 1,
      itemsPerPage: 10,
      sortBy: ['id'],
      sortDesc: [false],
      groupBy: [],
      groupDesc: [],
      mustSort: false,
      multiSort: false
    }
  }

  /**
   * Get table options
   */
  get tableOptions () {
    return this._tableOptions
  }

  /**
   * Set table options
   * @param {Object} options Table options
   */
  set tableOptions (tableOptions) {
    this._tableOptions = tableOptions
    this.storeSetting('tableOptions', tableOptions)
  }
}

export default ManagedItems
