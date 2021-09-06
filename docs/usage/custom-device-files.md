# Testing custom devices config

Zwave-js has an iternal database where it stores its device configuration files. Should you wish to modify a device file, or if you need to test a custom config device file, you may do so by placing the file inside a folder in the **store directory** named `config` (By default it is: `<app-root-folder>/store/config`).

For additional information, see the zwave-js [docs](https://zwave-js.github.io/node-zwave-js/#/api/driver?id=zwaveoptions):

> `deviceConfigPriorityDir`: Allows you to specify a directory from where device configuration files can be loaded with higher priority than the included ones. This directory does not get indexed and should be used sparingly, e.g. when custom files are absolutely necessary or for testing.

This directory does not expect any special structure. It can be organized as you like. When a custom device configuration is loaded successfully, you should see this in the zwave-js logs:

```js
10:32:09.322 CNTRLR   [Node 001] User-provided device config loaded
10:32:09.329 CNTRLR   [Node 007] User-provided device config loaded
10:32:09.331 CNTRLR   [Node 015] User-provided device config loaded
10:32:09.351 CNTRLR   [Node 017] User-provided device config loaded
10:32:09.374 CNTRLR   [Node 025] User-provided device config loaded
```

> [!NOTE] Z2M needs to be restarted in order to pick up a user-provided device configs. This can be done from settings by hitting `SAVE` or by completely restarting the application.
> [!NOTE] You must re-interview a device for many types of changes in the device file to have an effect. E.g. changed configuration parameters, certain compat flags, etc.
