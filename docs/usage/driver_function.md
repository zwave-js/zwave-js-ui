# Driver function

A powerful functionality of UI is that it allows you to write your own async js function that has access to all backend instances.

## Usage

The context of the function (what `this` will contain) is:

```js
{
    zwaveClient, // instance of ZWaveClient
    require, // require function to require other modules
    logger, // Winston logger instance
}
```

This means that you can access them from inside the function using:

```js
const zwaveClient = this.zwaveClient
const logger = this.logger
const require = this.require
```

The only parameter passed to the function is the `driver` object that's an instance of the [ZwaveJS driver](https://zwave-js.github.io/node-zwave-js/#/api/driver).

It's like this:

```js
async function(driver) {
  // driver function code will be placed here
}
```

This functionality is both available using [MQTT Apis](/guide/mqtt?id=apis) and directly from Control Panel UI by clicking on bottom right FAB `+` > `🪄` button > Driver Function. Once you've clicked on the action, you'll see a modal that asks you to enter a function and/or select an existing **Snippet**

## Examples

```js
const fs = this.require('fs-extra')
const { storeDir } = this.require('../config/app')
const data = await driver.controller.backupNVMRaw()
await fs.writeFile(storeDir + '/NVM.bin', data, 'binary')
```

```js
const node = driver.controller.nodes.get(35)
await node.refreshInfo()
```

![Driver function](../_images/snippets.gif)
