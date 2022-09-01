const node = driver.controller.nodes.get(50)
const clonedNode = driver.controller.nodes.get(51)

const values = node.getDefinedValueIDs()

for(const v of values) {
    // clone only configuration CC values
	if(v.commandClass === 112) {
		const value = node.getValue(v)
		await clonedNode.setValue(v, value)
	}
}