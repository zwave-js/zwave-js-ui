const timeout = 10;
const resetSecurityClasses = false;

const interviewNodes = [];

//* Interview: selected nodes
interviewNodes.push(...[/* ids */].map(n => driver.controller.nodes.get(n)));

/**
 * Uncomment below if you rather want to choose based on power
 */
 
//* Interview: ONLY listening nodes
// driver.controller.nodes.forEach(node => {
//   if (node.isListening || node.isFrequentListening)
//     interviewNodes.push(node);
// });

//* Interview: ONLY none-listening (battery powered) nodes
// driver.controller.nodes.forEach(node => {
//   if (!(node.isListening || node.isFrequentListening))
//     interviewNodes.push(node);
// });

// Sleeping nodes will be added to this «queue».
const sleepingNodes = [];
for (const node of interviewNodes) {
  const nn = `«${node.name}» (id: ${node.id})`
  if (node.isControllerNode) {
    this.logger.warn(`Node ${nn} is the controller, skipping`);
  } else {
    if (node.isListening || node.isFrequentListening) {
      try {
        await new Promise((resolve, reject) => {
          this.logger.info(`Interviewing ${nn}.`);
          const to = setTimeout(() => {
            reject(new Error(
              `Interview of ${nn} took too long, timeout reached.`
            ));
          }, timeout * 60 * 1000);
          node.refreshInfo({ resetSecurityClasses: resetSecurityClasses });
          node.once("ready", () => {
              clearTimeout(to);
              resolve();          
          });
        });
      } catch (e) {
        this.logger.warn(e.message);
        if (node.isFrequentListening) {
          this.logger.info(`Adding ${nn} to sleeping queue.`);
          sleepingNodes.unshift(node);
        }
      }
    } else {
      this.logger.info(`Node ${nn}) is not listening, queing it.`);
      sleepingNodes.push(node);
    }
  }
}

for (const node of sleepingNodes) {
  this.logger.info(`Interviewing ${nn} in parallel.`);
  node.refreshInfo({ resetSecurityClasses: resetSecurityClasses });
}
