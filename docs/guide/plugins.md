# Plugins

Plugins are NodeJS packages that can be integrated into Z-Wave JS UI in order to add new awesome features. They have access to all the clients (zwave and mqtt) and express instance.

## Usage

A plugin is imported in Z-Wave JS UI using `require(pluginName)(context)` where the context provides access to these elements:

- `zwave`: Z-Wave client
- `mqtt`: MQTT client
- `app`: Express instance
- `logger`: A logger instance to log things in console/file based on logger general settings

In order to add a plugin you have to specify the absolute/relative path to it or, if it is available as an npm package, you can install it using the command:

```bash
npm i my-awesome-plugin
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

Types and interfaces are available [here](https://github.com/zwave-js/zwave-js-ui/blob/master/api/lib/CustomPlugin.ts)

## Available plugins

Here is a list of currently available plugins:

- [Prometheus metrics plugin](https://github.com/kvaster/zwavejs-prom)
- [Telegram alert plugin](https://github.com/kvaster/zwavejs-alert)
- [Prometheus exporter](https://github.com/billiaz/zj2m-prom-exporter)

## Example usage

For plugins that are not available on npm you could create a `plugins` directory on application `store` and inside this directory you can install the plugin:

```bash
git clone https://github.com/kvaster/zwavejs-prom.git
cd zwavejs-prom
npm install
```

Now go to UI, Settings tab, General section and under plugins write the path to that folder (better if using a absolute path, for example `/usr/app/store/plugins/zwavejs-prom`). Press on `SAVE` to store the new settings and your plugin is ready.
