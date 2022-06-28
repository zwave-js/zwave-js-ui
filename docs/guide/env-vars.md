# Environment variables

This is the list of the supported environment variables:

- `NETWORK_KEY`: Z-Wave S0 Network key. **Deprecated**
- Network keys:
  - `KEY_S0_Legacy`
  - `KEY_S2_Unauthenticated`
  - `KEY_S2_Authenticated`
  - `KEY_S2_AccessControl`
- HTTPS:
  - `HTTPS`: Enable https
  - `SSL_CERTIFICATE` (optional): Absolute path to SSL certificate (for Docker, ensure this is the path as it appears within the container)
  - `SSL_KEY` (optional): Absolute path to SSL key (for Docker, ensure this is the path as it appears within the container)
- `SESSION_SECRET`: Used as secret for session. If not provided the default one is used
- `USE_SECURE_COOKIE`: Set the cookie [secure](https://github.com/expressjs/session#cookiesecure) option.
- `PORT`: The port to listen to for incoming requests. Default is `8091`
- `HOST`: The host address to bind to. Default is `0.0.0.0`
- `STORE_DIR`: The absolute path to the directory where all files will be stored. Default is `<path to your z2m dir>/store`
- `BACKUPS_DIR`: The absolute path to the directory where all backups files will be stored. Default is `<path to your z2m dir>/store/backups`
- `ZWAVEJS_EXTERNAL_CONFIG`: Mostly needed for docker users, it's the path to the folder used by Z-Wave JS to [store config database](https://zwave-js.github.io/node-zwave-js/#/usage/external-config?id=specifying-an-external-config-db-location), by default on docker it is `/usr/src/app/store/.config-db`. For users that are using a custom `STORE_DIR` this must be changed too.
- `ZWAVEJS_LOGS_DIR`: The folder used to store Z-Wave JS logs if `Log to file` is selected in the Z-Wave settings. By default, this is the `store` folder.
- `MQTT_NAME`: The name used as client name when connecting to the mqtt server. Overrides `mqtt.name` in `settings.json`
- `DISABLE_LOG_ROTATION`: Set this env var to `'true'` to disable application log rotation management
- `Z2M_LOG_MAXFILES`: The maximum number of files to keep in the log directory, if you add `d` suffix this will set the number of days to keep logs. Default is `7d`
- `Z2M_LOG_MAXSIZE`: The maximum size of a single log file. Default is `50m` (50MB)
- `NO_LOG_COLORS`: Set this env var to `'true'` to disable application log colors also in the console.

These variables can be used when running the webpack dev server with HMR (most users will not need them):

- `SERVER_PORT`: The port the server is running. Default is `8091`
- `SERVER_SSL`: Set to `'true'` if server is using HTTPS / WSS scheme
- `SERVER_HOST`: The host address the server is binded to. Default is `0.0.0.0`
- `SERVER_URL`: Complete URL to server. If not set a combination of `SERVER_SSL`, `SERVER_HOST` and `SERVER_PORT` will be used.
