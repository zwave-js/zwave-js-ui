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
    this.items = items
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
    this.setTableOptions(this.getTableOptions())
    this.setColumns(this.getColumns())
    this.setFilters(this.getFilters())
    this.setSelected(this.getSelected())
  }

  /**
   * Reset all settings
   */
  reset () {
    this.setTableOptions(this.initialTableOptions())
    this.setColumns(this.initialColumns())
    this.setFilters(this.initialFilters())
    this.setSelected(this.initialSelected())
  }

  // Item handling

  /**
   * Get all managed items
   */
  getItems () {
    return this.items
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
   * Get item collection for filtering
   */
  getItemCollection () {
    return new NodeCollection(this.getItems())
  }

  /**
   * Get filtered items
   */
  getFilteredItems () {
    return ColumnFilterHelper.filterByFilterSpec(
      this.getItemCollection(),
      this.getAllTableHeaders(),
      this.getFilters()
    ).nodes // TODO: nodes should be items
  }

  /**
   * Set managed items
   * @param {Array} items Items to be managed
   */
  setItems (items) {
    this.items = items
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
  getAllTableHeaders () {
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
  getTableHeaders () {
    return this.getAllTableHeaders().filter(col =>
      this.columns.includes(col.value)
    )
  }

  /**
   * Get the active table colum list
   */
  getColumns () {
    return this.columns === undefined
      ? this.loadSetting('columns', this.initialColumns())
      : this.columns
  }

  /**
   * Get initial table column list
   */
  initialColumns () {
    return Object.keys(this.propDefs)
  }

  /**
   * Set the list of active table columns
   * @param {Array} columns List of columns to be set
   */
  setColumns (columns) {
    this.columns = columns
    this.storeSetting('columns', columns)
  }

  // Filters handling

  /**
   * Filter to selected items
   */
  filterSelected () {
    this.setPropFilter('id', {
      values: this.getSelected().map(item => item.id)
    })
  }

  /**
   * Get all filters
   */
  getFilters () {
    return this.filters === undefined
      ? this.loadSetting('filters', this.initialFilters())
      : this.filters
  }

  /**
   * Get initial filters
   */
  initialFilters () {
    return this.getAllTableHeaders().reduce((values, h) => {
      values[h.value] = {}
      return values
    }, {})
  }

  /**
   * Set all filters
   * @param {Object} filters Filters to be set
   */
  setFilters (filters) {
    this.filters = filters
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
  getGroupBy () {
    return this.getTableOptions().groupBy
  }

  /**
   * Get title for property group
   * @param {String} groupValue Property group value
   */
  getGroupByTitle (groupValue) {
    const groupBy = this.getGroupBy()
    const propDef = this.propDefs[groupBy[0]]
    return `${propDef.label ? propDef.label : groupBy[0]}: ${groupValue}`
  }

  /**
   * Is the table grouped by given property?
   * @param {String} propName Property name
   */
  isGroupBy (propName) {
    return this.getGroupBy().includes(propName)
  }

  /**
   * Set the table group by value
   * @param {Array} groupBy Group by value
   */
  setGroupBy (groupBy) {
    const opt = Object.assign(this.getTableOptions(), { groupBy: groupBy })
    this.setTableOptions(opt)
  }

  // Selection handling

  /**
   * Get selected items
   */
  getSelected () {
    return this.selected === undefined
      ? this.loadSetting('selected', this.initialSelected())
      : this.selected
  }

  /**
   * Get initial selected items
   */
  initialSelected () {
    return []
  }

  /**
   * Set selected items
   * @param {Array} selected List of selected items
   */
  setSelected (selected) {
    this.selected = selected
  }

  // Table options handling

  /**
   * Get table options
   */
  getTableOptions () {
    return this.tableOptions === undefined
      ? this.loadSetting('tableOptions', this.initialTableOptions())
      : this.tableOptions
  }

  /**
   * Get initial table options
   */
  initialTableOptions () {
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
   * Set table options
   * @param {Object} options Table options
   */
  setTableOptions (options) {
    this.tableOptions = options
    this.storeSetting('tableOptions', this.tableOptions)
  }
}

export default ManagedItems
