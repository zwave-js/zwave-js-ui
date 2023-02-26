/**
 * This snippet can be used to ping dead nodes in your network
 * ATTENTION: Be aware that this is not a good practise, if your nodes
 * become dead, you should try to find out why as you will likely have connectivity
 * issues. More info here: https://zwave-js.github.io/node-zwave-js/#/troubleshooting/connectivity-issues
 */

driver.controller.nodes.forEach(async (node) => {
    // if node is Dead
    if (node.status === 3) {
        // pinging it
        await node.ping()
    }
})