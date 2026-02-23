# Plugins

Plugins are NodeJS packages that can be integrated into Z-Wave JS UI in order to add new awesome features. They have access to all the clients (zwave and mqtt) and express instance.

## Usage

A plugin is loaded using ES dynamic `import()` and must export a **default class** whose constructor receives a `PluginContext` object:

- `zwave`: Z-Wave client
- `mqtt`: MQTT client
- `app`: Express router (scoped to the plugin)
- `logger`: A logger instance to log things in console/file based on logger general settings

To add a plugin, go to the UI **Settings -> General -> Plugins** and either:

- Select an **npm plugin** from the dropdown (it will be auto-installed on save)
- Type an **absolute path** to a local plugin directory (e.g. `/usr/src/app/store/plugins/my-plugin`) and press enter

When you save settings, npm plugins are automatically installed into the `store/.plugins` directory. This keeps plugins separate from the app's own `node_modules`.

### Updating plugins

Click the **Update Plugins** button next to the plugin selector in Settings to update all installed npm plugins to their latest versions.

## Plugin Interface

Every plugin must be an ES module that **default-exports a class** implementing the [`CustomPlugin`](https://github.com/zwave-js/zwave-js-ui/blob/master/api/lib/CustomPlugin.ts) interface:

```ts
interface PluginContext {
  zwave: ZwaveClient
  mqtt: MqttClient
  app: Router       // Express router
  logger: ModuleLogger
}

interface CustomPlugin extends PluginContext {
  name: string
  destroy(): Promise<void>
}
```

- The **constructor** receives a `PluginContext` and should store references to the clients it needs.
- The **`destroy()`** method is called when the application shuts down or settings are updated. Use it to clean up event listeners, intervals, or any other state.
- The `name` property is set automatically by the application.

## Developing custom Plugins

Here is a minimal example of a custom plugin:

```js
export default class MyPlugin {
  constructor(ctx) {
    this.zwave = ctx.zwave;
    this.mqtt = ctx.mqtt;
    this.logger = ctx.logger;
    this.express = ctx.app;

    // this.express.get('/my-route', (req, res) => { ... });
    // this.mqtt.publish(...);
    // this.zwave.on('valueChanged', this.onValueChanged);
    // ... add all the stuff you need here
  }

  async destroy() {
    // clean up event listeners, intervals, etc.
  }
}
```

## Docker Plugins

When running Z-Wave JS UI in Docker, the working directory is `/usr/src/app`. Plugins stored under the `store` directory persist across container restarts.

### Using npm plugins

npm plugins are automatically installed into `store/.plugins` when selected in the UI and saved. No manual installation is needed. You can also pre-install plugins at build time using the `plugins` Docker build argument:

```bash
docker build --build-arg plugins="@kvaster/zwavejs-prom @ongit/zwavejsui-prom-exporter" -f docker/Dockerfile -t zwavejs/zwave-js-ui .
```

### Using a local plugin

1. Create a `plugins` directory inside your store volume:

```bash
mkdir -p /path/to/your/store/plugins
```

2. Clone or copy your plugin into that directory:

```bash
cd /path/to/your/store/plugins
git clone https://github.com/kvaster/zwavejs-prom.git
cd zwavejs-prom
npm install
```

3. In the UI, go to **Settings -> General -> Plugins** and enter the path as it appears **inside the container**:

```text
/usr/src/app/store/plugins/zwavejs-prom
```

4. Press **SAVE** to store the new settings and the plugin will be loaded.

### Using a separate volume for third-party plugins

If you prefer to keep plugins separate from the main store, mount an additional volume:

```yaml
volumes:
  - ./store:/usr/src/app/store
  - ./plugins:/usr/src/app/plugins
```

Then reference the plugin path as `/usr/src/app/plugins/my-plugin` in the settings.

## Available plugins

Here is a list of currently available plugins:

- [`@ongit/zwavejsui-prom-exporter`](https://www.npmjs.com/package/@ongit/zwavejsui-prom-exporter) - Prometheus metrics exporter for Z-Wave JS UI
- [`@kvaster/zwavejs-prom`](https://github.com/kvaster/zwavejs-prom) - Prometheus metrics for Z-Wave JS
- [Telegram alert plugin](https://github.com/kvaster/zwavejs-alert)
