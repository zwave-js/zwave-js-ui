const nodes = require('./fullNodeList.json')
const fs = require('fs')

for (const n of nodes) {
	const values = []
	for (const vId in n.values) {
		values.push(n.values[vId])
	}
	n.values = values
}

fs.writeFileSync('./testNodes.json', JSON.stringify(nodes))
