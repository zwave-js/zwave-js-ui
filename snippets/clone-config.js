// replace `undefined` with the id of the node you want to clone
const node = driver.controller.nodes.get(undefined);

// list here all the nodes ids you want to copy configuration to
const clonedNodes = [].map(n => driver.controller.nodes.get(n));

const values = node.getDefinedValueIDs()

for (const clonedNode of clonedNodes) {
  for(const v of values) {
  	if(v.commandClass === 112) {
  		await clonedNode.setValue(v, 
  		  node.getValue(v)
  		)
  	}
  }
}