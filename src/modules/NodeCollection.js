export class NodeCollection {
  constructor (nodes) {
    this.nodes = nodes
  }

  _isUndefined (value) {
    return value === undefined || value === null || value === ''
  }

  _strValue (str, caseSensitive) {
    return caseSensitive ? `${str}` : `${str}`.toLowerCase()
  }

  _createStringFilter (filterValue, caseSensitive) {
    if (this._isUndefined(filterValue)) {
      filterValue = ''
    }
    const strFilter = this._strValue(filterValue, caseSensitive)
    return value => this._strValue(value, caseSensitive).indexOf(strFilter) >= 0
  }

  _filterByProps (node, properties, filter) {
    const mergedProps = [properties].reduce(
      (merged, prop) => merged.concat(prop),
      []
    )
    return mergedProps.find(prop => filter(node[prop]))
  }

  filter (properties, filter) {
    const filtered = this.nodes.filter(node =>
      this._filterByProps(node, properties, filter)
    )
    return new NodeCollection(filtered)
  }

  contains (properties, value, caseSensitive = false) {
    return this.filter(
      properties,
      this._createStringFilter(value, caseSensitive)
    )
  }

  equals (properties, value) {
    return this.filter(
      properties,
      nodeValue => this._isUndefined(value) || value === nodeValue
    )
  }

  betweenNumber (properties, minValue, maxValue) {
    return this.filter(
      properties,
      nodeValue =>
        (this._isUndefined(minValue) || minValue <= nodeValue) &&
        (this._isUndefined(maxValue) || maxValue >= nodeValue)
    )
  }

  betweenDate (properties, minValue, maxValue) {
    return this.filter(properties, nodeValue => {
      const nodeValueTime = new Date(nodeValue).getTime()
      return (
        (this._isUndefined(minValue) ||
          new Date(minValue).getTime() <= nodeValueTime) &&
        (this._isUndefined(maxValue) ||
          new Date(maxValue).getTime() >= nodeValueTime)
      )
    })
  }

  equalsAny (properties, values) {
    return this.filter(
      properties,
      nodeValue => values.length === 0 || values.indexOf(nodeValue) >= 0
    )
  }

  values (property) {
    const uniqueMap = {}
    this.nodes.forEach(node => {
      const strVal = this._strValue(node[property])
      uniqueMap[strVal] = uniqueMap[strVal] || node[property]
    })
    return Object.keys(uniqueMap)
      .sort()
      .map(key => uniqueMap[key])
  }
}

export default NodeCollection
