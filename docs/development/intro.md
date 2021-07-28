# Development

Developers who wants to debug the application have to open 2 terminals.

In first terminal run `yarn run dev` to start webpack-dev for front-end developing and hot reloading at <http://localhost:8092>
(**THE PORT FOR DEVELOPING IS 8092**)

In the second terminal run `yarn run dev:server` to start the backend server with inspect and auto restart features

To package the application run `yarn run pkg` command and follow the steps

## Developing against a different backend

By default running `yarn run dev:server` will proxy the requests to a backend listening on _localhost_ on port _8091_.

If you want to run the development frontend against a different backend you have the following environment variables
that you can use to redirect to a different backend:

- **SERVER_HOST**: [Default: 'localhost'] the hostname or IP of the backend server you want to use;
- **SERVER_PORT**: [Default: '8091'] the port of the backend server you want to use;
- **SERVER_SSL**: [Default: undefined] if set to a value it will use _https_/_wss_ to connect to the backend;
- **SERVER_URL**: [Default: use the other variables] the full URL for the backend API, IE: `https://zwavetomqtt.home.net:8443/`
- **SERVER_WS_URL**: [Default: use the other variables] the full URL for the backend Socket, IE: `wss://zwavetomqtt.home.net:8443/`

## Testing custom devices config

Zwave-js has an iternal DB where it stores device configuration files. When you need to test custom config devices you can place your files inside a folder in **store directory** named `config` (By default it is: `<app-root-folder>/store/config`).

According to zwave-js [docs](https://zwave-js.github.io/node-zwave-js/#/api/driver?id=zwaveoptions):

> `deviceConfigPriorityDir`: Allows you to specify a directory where device configuration files can be loaded from with higher priority than the included ones. This directory does not get indexed and should be used sparingly, e.g. for testing.

This directory does not expect any special structure. Just organize it as you like. When a custom device configuration is loaded successfully you should see this in zwave-js logs:

```js
10:32:09.322 CNTRLR   [Node 001] User-provided device config loaded
10:32:09.329 CNTRLR   [Node 007] User-provided device config loaded
10:32:09.331 CNTRLR   [Node 015] User-provided device config loaded
10:32:09.351 CNTRLR   [Node 017] User-provided device config loaded
10:32:09.374 CNTRLR   [Node 025] User-provided device config loaded
```

> [!NOTE] Z2M needs to be restarted in order to pick up user-provided device configs. This can be done from settings by hitting `SAVE` or by completely restart the application.


> [!NOTE] You will need to re-interview the device for certain changes to have an effect, for example changed configuration parameters, certain compat flags, etc.

