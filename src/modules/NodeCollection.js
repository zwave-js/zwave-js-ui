export class NodeCollection {
	constructor(nodes, propDefs) {
		this.nodes = nodes
		this.propDefs = propDefs
	}

	_isUndefined(value) {
		return value === undefined || value === null || value === ''
	}

	_strValue(str, caseSensitive) {
		return caseSensitive ? `${str}` : `${str}`.toLowerCase()
	}

	_createStringFilter(filterValue, caseSensitive) {
		if (this._isUndefined(filterValue)) {
			filterValue = ''
		}
		const strFilter = this._strValue(filterValue, caseSensitive)
		return (value) =>
			this._strValue(value, caseSensitive).indexOf(strFilter) >= 0
	}

	_createRegexFilter(filterValue, caseSensitive) {
		if (this._isUndefined(filterValue)) {
			filterValue = ''
		}
		const strFilter = this._strValue(filterValue, caseSensitive)
		return (value) => {
			let res = true
			try {
				res = !!this._strValue(value, caseSensitive).match(strFilter)
				// eslint-disable-next-line no-empty
			} catch (e) {} // Ignore filter on regexp error
			return res
		}
	}

	_filterByProps(node, properties, filter) {
		const mergedProps = [properties].reduce(
			(merged, prop) => merged.concat(prop),
			[]
		)
		return mergedProps.find((prop) =>
			filter(
				this.propDefs &&
					typeof this.propDefs[prop].customValue === 'function'
					? this.propDefs[prop].customValue(node)
					: node[prop]
			)
		)
	}

	filter(properties, filter) {
		const filtered = this.nodes.filter((node) =>
			this._filterByProps(node, properties, filter)
		)
		return new NodeCollection(filtered, this.propDefs)
	}

	contains(properties, value, caseSensitive = false) {
		return this.filter(
			properties,
			this._createStringFilter(value, caseSensitive)
		)
	}

	matches(properties, value, caseSensitive = false) {
		return this.filter(
			properties,
			this._createRegexFilter(value, caseSensitive)
		)
	}

	equals(properties, value) {
		return this.filter(
			properties,
			(nodeValue) => this._isUndefined(value) || value === nodeValue
		)
	}

	filterNumberCol(col, filter) {
		return this.betweenNumber(
			col,
			filter ? filter.min : null,
			filter ? filter.max : null
		).equalsAny(col, filter ? (filter.values ? filter.values : []) : [])
	}

	filterStringCol(col, filter) {
		return this.matches([col], filter ? filter.match : '').equalsAny(
			col,
			filter ? (filter.values ? filter.values : []) : []
		)
	}

	filterBoolCol(col, filter) {
		return this.equals(col, filter ? filter.boolValue : null)
	}

	filterDateCol(col, filter) {
		return this.betweenDate(
			col,
			filter ? filter.from : null,
			filter ? filter.to : null
		)
	}

	betweenNumber(properties, minValue, maxValue) {
		return this.filter(
			properties,
			(nodeValue) =>
				(this._isUndefined(minValue) || minValue <= nodeValue) &&
				(this._isUndefined(maxValue) || maxValue >= nodeValue)
		)
	}

	betweenDate(properties, minValue, maxValue) {
		return this.filter(properties, (nodeValue) => {
			const nodeValueTime = new Date(nodeValue).getTime()
			return (
				(this._isUndefined(minValue) ||
					new Date(minValue).getTime() <= nodeValueTime) &&
				(this._isUndefined(maxValue) ||
					new Date(maxValue).getTime() >= nodeValueTime)
			)
		})
	}

	equalsAny(properties, values) {
		return this.filter(
			properties,
			(nodeValue) => values.length === 0 || values.indexOf(nodeValue) >= 0
		)
	}
}

export default NodeCollection
