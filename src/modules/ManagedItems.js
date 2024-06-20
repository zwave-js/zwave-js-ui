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
	constructor(items, propDefs, store, storePrefix = 'items_') {
		this.settings = new Settings(store)
		this.doStore = !!storePrefix
		this.storePrefix = storePrefix || ''
		this.propDefs = propDefs
		this.items = items
		this.initialize()
	}

	/**
	 * Load values from settings store or set to initial values
	 */
	initialize() {
		this._tableOptions =
			this.tableOptions === undefined
				? this.loadSetting('tableOptions', this.initialTableOptions)
				: this.tableOptions
		this._columns =
			this.tableColumns === undefined
				? this.loadSetting('tableColumns', this.initialTableColumns)
				: this.tableColumns
		this._filters =
			this.filters === undefined
				? this.loadSetting('filters', this.initialFilters)
				: this.filters

		// sometimes columns are updated in new releases, this allows us to show them
		if (!this.loadSetting('cleared2', false)) {
			this._filters = this.initialFilters
			this._columns = this.initialTableColumns
			this.storeSetting('cleared2', true)
		}

		this._selected = this.initialSelected

		// fix possible inconsistence from localstorage
		for (const p in this.filters) {
			if (!this.propDefs[p]) {
				delete this.filters[p]
			}
		}

		this.tableColumns = this.tableColumns.filter(
			(t) => !!this.propDefs[t.name],
		)
	}

	/**
	 * Reset all settings
	 */
	reset() {
		this.tableOptions = this.initialTableOptions
		this.tableColumns = this.initialTableColumns
		this.filters = this.initialFilters
		this.selected = this.initialSelected
	}

	// Item handling

	/**
	 * Get all managed items
	 */
	get items() {
		return this._items
	}

	/**
	 * Set managed items
	 * @param {Array} items Items to be managed
	 */
	set items(items) {
		this._items = items
	}

	/**
	 * Get a property value of an item respecting a possibly defined customValue function and a default value (if undefined)
	 */
	getPropValue(item, propName, defaultValue) {
		let customValue = this.propDefs[propName].customValue
		let value =
			typeof customValue === 'function'
				? customValue(item)
				: item[propName]
		if (defaultValue !== undefined && value === undefined) {
			value = defaultValue
		}
		return value
	}

	/**
	 * Get all property values from items
	 */
	getPropValues(propName) {
		const uniqueMap = {}

		const undefinedPlaceholder =
			this.propDefs[propName].undefinedPlaceholder

		this.items.forEach((item) => {
			const value = this.getPropValue(item, propName)
			if (value !== undefined && value !== null) {
				uniqueMap[value] = uniqueMap[value] ?? value
			} else if (undefinedPlaceholder) {
				uniqueMap[undefinedPlaceholder] = undefinedPlaceholder
			}
		})
		return Object.keys(uniqueMap)
			.sort()
			.map((key) => uniqueMap[key])
	}

	/**
	 * Get values of all item properties
	 */
	get propValues() {
		const values = {}
		Object.keys(this.propDefs).forEach((propName) => {
			values[propName] = this.getPropValues(propName)
		})
		return values
	}

	/**
	 * Get filtered items
	 */
	get filteredItems() {
		return ColumnFilterHelper.filterByFilterSpec(
			new NodeCollection(this.items, this.propDefs),
			this.allTableHeaders,
			this.filters,
		).nodes // TODO: nodes should be items
	}

	// Setting storage methods

	/**
	 * Load a key from the settings store
	 * @param {String} key Key to be loaded from the settings store
	 * @param {Any} defaultVal Default value if key is not in settings store
	 */
	loadSetting(key, defaultVal) {
		return this.settings.load(this.storePrefix + key, defaultVal)
	}

	/**
	 * Key/value to be stored to the settings store
	 * @param {String} key Key to be stored
	 * @param {Any} val Value to be stored
	 */
	storeSetting(key, val) {
		if (this.doStore) {
			this.settings.store(this.storePrefix + key, val)
		}
	}

	// Table columns handling

	/**
	 * Internal function to get a table header definition for a specific column name
	 */
	_getTableHeaderForColumn(colName) {
		const propDef = this.propDefs[colName]
		const header = {
			value: colName,
			text: propDef.label === undefined ? colName : propDef.label,
			type: propDef.type === undefined ? 'string' : propDef.type,
			groupable:
				propDef.groupable === undefined ? true : !!propDef.groupable,
		}
		// NOTE: These extend the VDataTable headers:
		if (propDef.customGroupValue)
			header.customGroupValue = propDef.customGroupValue
		if (propDef.customSort) header.customSort = propDef.customSort
		if (propDef.customValue) header.customValue = propDef.customValue
		if (propDef.richValue) header.richValue = propDef.richValue
		return header
	}

	/**
	 * Get all table column headers
	 */
	get allTableHeaders() {
		return Object.keys(this.propDefs).reduce((headers, colName) => {
			headers.push(this._getTableHeaderForColumn(colName))
			return headers
		}, [])
	}

	/**
	 * Get visible table column headers
	 */
	get tableHeaders() {
		return this.tableColumns.reduce((tableHeaders, column) => {
			if (column.visible) {
				tableHeaders.push(this._getTableHeaderForColumn(column.name))
			}
			return tableHeaders
		}, [])
	}

	/**
	 * Get initial table column list
	 */
	get initialTableColumns() {
		return Object.keys(this.propDefs).reduce((tableColumns, propName) => {
			tableColumns.push({
				name: propName,
				visible: true,
			})
			return tableColumns
		}, [])
	}

	/**
	 * Get the active table column list
	 */
	get tableColumns() {
		return this._columns
	}

	/**
	 * Set the list of table columns with visibility status
	 * @param {Array} tableColumns List of table columns to be set
	 */
	set tableColumns(tableColumns) {
		this._columns = tableColumns
		this.storeSetting('tableColumns', tableColumns)
	}

	// Filters handling

	/**
	 * Filter to selected items
	 */
	setFilterToSelected() {
		this.setPropFilter('id', {
			values: this.selected.map((item) => item.id),
		})
	}

	/**
	 * Get initial filters
	 */
	get initialFilters() {
		return this.allTableHeaders.reduce((values, h) => {
			values[h.value] = {}
			return values
		}, {})
	}

	/**
	 * Get all filters
	 */
	get filters() {
		return this._filters
	}

	/**
	 * Set all filters
	 * @param {Object} filters Filters to be set
	 */
	set filters(filters) {
		this._filters = filters
		this.storeSetting('filters', filters)
	}

	/**
	 * Get filter for property
	 * @param {String} propName Property name
	 */
	getPropFilter(propName) {
		return this.filters[propName]
	}

	/**
	 * Set filter for property
	 * @param {String} propName Property name
	 * @param {Object} filterDef Filter definition
	 */
	setPropFilter(propName, filterDef) {
		this.filters = this.filters ? this.filters : {}
		const undefinedPlaceholder =
			this.propDefs[propName].undefinedPlaceholder

		// when undeginedPlaceholder is set, we need to replace the filter value with undefined
		if (undefinedPlaceholder && filterDef?.values) {
			filterDef.values = filterDef.values.map((f) =>
				f === undefinedPlaceholder ? undefined : f,
			)
		}

		this.filters[propName] = filterDef
		this.storeSetting('filters', this.filters)
	}

	// GroupBy handling

	/**
	 * Get table group by value
	 */
	get groupBy() {
		return this.tableOptions.groupBy
	}

	/**
	 * Set the table group by value
	 * @param {Array} groupBy Group by value
	 */
	set groupBy(groupBy) {
		this.tableOptions = Object.assign(this.tableOptions, {
			groupBy: groupBy,
		})
	}

	/**
	 * Get title for property group
	 * @param {String} groupValue Property group value
	 */
	get groupByTitle() {
		const propDef = this.propDefs[this.groupBy[0]]
		return propDef !== undefined && propDef.label
			? propDef.label
			: this.groupBy[0]
	}

	/**
	 * Is the table grouped by given property?
	 * @param {String} propName Property name
	 */
	isGroupBy(propName) {
		return this.groupBy.includes(propName)
	}

	// Selection handling

	/**
	 * Get initial selected items
	 */
	get initialSelected() {
		return []
	}

	/**
	 * Get selected items
	 */
	get selected() {
		return this._selected
	}

	/**
	 * Set selected items
	 * @param {Array} selected List of selected items
	 */
	set selected(selected) {
		this._selected = selected
	}

	// Table options handling

	/**
	 * Get initial table options
	 */
	get initialTableOptions() {
		return {
			page: 1,
			itemsPerPage: 10,
			sortBy: ['id'],
			sortDesc: [false],
			groupBy: [],
			groupDesc: [],
			mustSort: false,
			multiSort: false,
		}
	}

	/**
	 * Get table options
	 */
	get tableOptions() {
		return this._tableOptions
	}

	/**
	 * Set table options
	 * @param {Object} options Table options
	 */
	set tableOptions(tableOptions) {
		this._tableOptions = tableOptions
		this.storeSetting('tableOptions', tableOptions)
	}

	/**
	 * Determine the label to be displayed when grouped
	 * @param {any} group Value of the group
	 * @returns Label to be displayed for the group respecting a possibly existent customGroupValue
	 */
	groupValue(group) {
		let formattedGroup = group
		if (
			this.groupBy &&
			this.groupBy[0] &&
			this.propDefs[this.groupBy[0]] &&
			typeof this.propDefs[this.groupBy[0]].customGroupValue ===
				'function'
		) {
			formattedGroup = this.propDefs[this.groupBy[0]].customGroupValue(
				group,
				this.groupBy,
			)
		}
		return this.groupByTitle + ': ' + formattedGroup
	}

	/**
	 * Sort the items by a certain property respecting an existing customSort function
	 * @param {array} items Items to be sorted
	 * @param {array} sortBy Array with properties to sort by (only one is supported!)
	 * @param {array} sortDesc Array with boolean values to sort in descending order if true, ascending otherwise (only one is supported!)
	 * @returns Sorted array of items
	 */
	sort(items, sortBy, sortDesc) {
		// TODO: Why is this.propDefs undefined when this method is directly attached to a VDataTable using 'custom-sort'?
		// See https://stackoverflow.com/a/54612408
		if (!sortBy[0] || !this.propDefs || !this.propDefs[sortBy[0]]) {
			return items
		}
		items.sort((a, b) => {
			let propName = sortBy[0]
			if (
				this.propDefs[sortBy[0]] &&
				typeof this.propDefs[sortBy[0]].customSort === 'function'
			) {
				// Use special sort function if one is defined for the sortBy column
				return this.propDefs[sortBy[0]].customSort(
					items,
					sortBy,
					sortDesc,
					a,
					b,
				)
			} else {
				// Standard sort for every other column
				let valA = this.getPropValue(a, propName, '')
				let valB = this.getPropValue(b, propName, '')
				let res = valA < valB ? -1 : valA > valB ? 1 : 0
				res = sortDesc[0] ? -res : res
				return res
			}
		})
		return items
	}

	/**
	 * Enrich a value of an object property to display with icon, label, tooltip and styles.
	 * @param {Object} item Object to display the enriched value for
	 * @param {*} propName Name of the object property to be enriched
	 * @returns Object with complex value label
	 */
	richValue(item, propName) {
		return typeof this.propDefs[propName].richValue === 'function'
			? this.propDefs[propName].richValue(item, propName)
			: {
					align: 'left',
					icon: '',
					iconStyle: '',
					displayValue: this.getPropValue(item, propName),
					displayStyle: '',
					description: '',
					rawValue: this.getPropValue(item, propName),
				}
	}
}

export default ManagedItems
