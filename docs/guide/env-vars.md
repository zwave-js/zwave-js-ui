# Environment variables

This is the list of the actually supported env vars:

- `NETWORK_KEY`: Zwave Network key
- `STORE_DIR`: The absolute path to the directory where all files will be stored. Default is `<path to your z2m dir>/store`
- `SERVER_PORT`: The port to listen to for incoming requests. Default is `8091`
- `SERVER_SSL`: Set to true to use HTTPS / WSS scheme
- `SERVER_HOST`: The host address to bind to. Default is `0.0.0.0
- `SERVER_URL`: Complete URL to server. If not set a combination of `SERVER_SSL`, `SERVER_HOST` and `SERVER_PORT` will be used.
- `SERVER_WS_URL`: Complete URL to websocket server. If not set a combination of `SERVER_SSL`, `SERVER_HOST` and `SERVER_PORT` will be used.
