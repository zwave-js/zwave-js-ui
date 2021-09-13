# Using Custom Device Configuration Files

Z-Wave JS has an internal database where it stores its device configuration files. Should you wish to modify a device file, or if you need to test a custom config device file, you may do so by creating a folder inside your store folder named `config` and placing the file inside that folder. (By default it is: `<app-root-folder>/store/config`).

This directory does not get indexed and should be used sparingly, e.g. when custom files are absolutely necessary or for testing. This directory does not expect any special structure unless you are using a template, in which case you must mimic the structure required by the template. Otherwise, it can be organized as you like.

For information about the content of device files, see the Z-Wave JS [device file docs](https://zwave-js.github.io/node-zwave-js/#/config-files/file-format).

> [!NOTE] ZWavejs2Mqtt needs to be restarted in order to pick up a user-provided device configs. This can be done from settings by hitting `SAVE` or by completely restarting the application.

> [!NOTE] You must re-interview a device for many types of changes in the device file to have an effect. E.g. changed configuration parameters, certain compat flags, etc.

## Logging

When a custom device configuration is loaded successfully, you should see this in the Z-Wave JS logs:

```js
10:32:09.322 CNTRLR   [Node 001] User-provided device config loaded
10:32:09.329 CNTRLR   [Node 007] User-provided device config loaded
10:32:09.331 CNTRLR   [Node 015] User-provided device config loaded
10:32:09.351 CNTRLR   [Node 017] User-provided device config loaded
10:32:09.374 CNTRLR   [Node 025] User-provided device config loaded
```
