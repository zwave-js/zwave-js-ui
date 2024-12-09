# Environment variables

This is the list of the supported environment variables:

- `DEFAULT_USERNAME`: The default username when auth is enabled.
- `DEFAULT_PASSWORD`: The default password when auth is enabled.
- `NETWORK_KEY`: Z-Wave S0 Network key. **Deprecated**
- Network keys:
  - `KEY_S0_Legacy`
  - `KEY_S2_Unauthenticated`
  - `KEY_S2_Authenticated`
  - `KEY_S2_AccessControl`
  - `KEY_LR_S2_Authenticated`
  - `KEY_LR_S2_AccessControl`
- HTTPS:
  - `HTTPS`: Enable https
  - `SSL_CERTIFICATE` (optional): Absolute path to SSL certificate (for Docker, ensure this is the path as it appears within the container)
  - `SSL_KEY` (optional): Absolute path to SSL key (for Docker, ensure this is the path as it appears within the container)
- `SESSION_SECRET`: Used as secret for session. If not provided the default one is used
- `USE_SECURE_COOKIE`: Set the cookie [secure](https://github.com/expressjs/session#cookiesecure) option.
- `PORT`: The port to listen to for incoming requests. Default is `8091`
- `HOST`: The host address to bind to. Keep it empty to bind to all interfaces both IPv4 and IPv6
- `STORE_DIR`: The absolute path to the directory where all files will be stored. Default is `<path to your zui dir>/store`
- `BACKUPS_DIR`: The absolute path to the directory where all backups files will be stored. Default is `<path to your zui dir>/store/backups`
- `ZWAVEJS_EXTERNAL_CONFIG`: It's the path to the folder used by Z-Wave JS to [store config database](https://zwave-js.github.io/node-zwave-js/#/usage/external-config?id=specifying-an-external-config-db-location), by default it is `<store_dir>/.config-db`.
- `ZWAVEJS_LOGS_DIR`: The folder used to store Z-Wave JS logs if `Log to file` is selected in the Z-Wave settings. By default, this is the `store` folder.
- `MQTT_NAME`: The name used as client name when connecting to the mqtt server. Overrides `mqtt.name` in `settings.json`
- `DISABLE_LOG_ROTATION`: Set this env var to `'true'` to disable application log rotation management
- `ZUI_LOG_MAXFILES`: The maximum number of files to keep in the log directory, if you add `d` suffix this will set the number of days to keep logs. Default is `7d`.
- `ZUI_LOG_MAXSIZE`: The maximum size of a single log file. Default is `50m` (50MB)
- `NO_LOG_COLORS`: Set this env var to `'true'` to disable application log colors also in the console.
- `ZUI_NO_CONSOLE`: Set this env var to `'true'` to disable application log in the console.
- `TRUST_PROXY`: Set this env in order to trust the proxy. See [express behind proxies](https://expressjs.com/en/guide/behind-proxies.html) for more info about allowed values.
- `FORCE_DISABLE_SSL`: Set this env var to `'true'` to disable SSL.
- `BASE_PATH`: Set this env var to the base path where the application is served. Default is `/`.
- `UID_DISCOVERY_PREFIX`: Sets the prefix used for MQTT Discovery `unique_id` of entities. Default is `zwavejs2mqtt_`.
- `TZ`: Set this env var to the timezone you want to use on UI. Default to browser TZ.
- `LOCALE`: Set this env var to the locale you want to use on UI. Default to browser locale.
- `DISCOVERY_DISABLE_CC_CONFIGURATION`: Set this env var to `'true'` to disable Configuration CC MQTT Discovery.
