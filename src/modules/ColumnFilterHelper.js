export class ColumnFilterHelper {
	constructor(colDef) {
		this.colDef = colDef
	}

	static defaultFilter(colType) {
		const defaults = {
			boolean: {
				boolValue: null,
			},
			date: {
				from: null,
				to: null,
			},
			number: {
				min: null,
				max: null,
				values: [],
			},
			string: {
				match: '',
				values: [],
			},
		}
		return defaults[colType]
	}

	static filterProps(colType) {
		return Object.keys(ColumnFilterHelper.defaultFilter(colType))
	}

	static filterSpec(colType, value) {
		const filter = {}
		ColumnFilterHelper.filterProps(colType).forEach((key) => {
			if (value[key] !== undefined && value[key] !== null) {
				if (Array.isArray(value[key]) && value[key].length === 0) {
					// Skip empty arrays
					return
				}
				if (typeof value[key] === 'string' && value[key] === '') {
					// Skip empty strings
					return
				}
				filter[key] = value[key]
			}
		})
		return filter
	}

	static filterByFilterSpec(nodes, headers, filters) {
		for (const column of headers) {
			const filter = filters ? filters[column.key] : undefined
			if (!filter) continue
			switch (column.type) {
				case 'number':
					nodes = nodes.filterNumberCol(column.key, filter)
					break
				case 'string':
					nodes = nodes.filterStringCol(column.key, filter)
					break
				case 'boolean':
					nodes = nodes.filterBoolCol(column.key, filter)
					break
				case 'date':
					nodes = nodes.filterDateCol(column.key, filter)
					break
			}
		}
		return nodes
	}
}

export default ColumnFilterHelper
