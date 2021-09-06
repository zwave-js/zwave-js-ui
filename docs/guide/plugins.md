# Plugins

Plugins are nodejs packages that can be integrated in zwavejsmqtt in order to add new awesome features. They have access to all the clients (zwave and mqtt) and express instance.

## Usage

A plugin is imported in zwavejs1mqtt using `require(pluginName)(context)` where context provides access to these elements:

- `zwave`: Zwave client
- `mqtt`: Mqtt client
- `app`: Express instance
- `logger`: A logger instance to log things in console/file based on logger general settings

In order to add a plugin you have to specify the absolute/relative path to it or, if it is available as an npm package, you can install it using the command:

```bash
yarn i my-awesome-plugin
```

## Developing custom Plugins

In order to implement a plugin, you need to create a class with a constructor that accepts a single parameter that is the context we spoke in [usage](#usage) section and a `destroy` function that will be called when application is closed or settings updated.

Here is a minimal example of a custom plugin:

```js
function MyPlugin (ctx) {
  this.zwave = ctx.zwave
  this.mqtt = ctx.mqtt
  this.logger = ctx.logger
  this.express = ctx.app

  // this.express.get('/my-route', function(req, res) {...})
  // this.mqtt.publish(...)
  // this.zwave.on('valueChanged', onValueChanged)
  // ... add all the stuff you need here
}

MyPlugin.prototype.destroy = async function () {
  // clean up the state
}

module.export = MyPlugin
```

Types and interfaces are available [here](https://github.com/zwave-js/zwavejs2mqtt/blob/master/lib/CustomPlugin.ts)
