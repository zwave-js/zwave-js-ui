# Socket.IO API

Z-Wave JS UI uses [Socket.IO](https://socket.io/) for real-time communication between the server and clients. External clients (scripts, integrations, dashboards) can connect to the same Socket.IO endpoint used by the web UI to receive live events such as node updates, value changes, and controller status.

## Connecting

```js
import { io } from "socket.io-client";

const socket = io("http://localhost:8091", {
  path: "/socket.io",
  // if authentication is enabled:
  auth: { token: "your-jwt-token" },
});
```

The JWT token is obtained by calling `POST /api/authenticate` with valid credentials.

## Channel subscriptions

Events are organized into **channels**. Clients must subscribe to channels to receive events &mdash; unsubscribed clients receive nothing (except per-socket responses like `INIT` and API callbacks).

### Subscribing

Send a `SUBSCRIBE` event with an array of channel names:

```js
socket.emit("SUBSCRIBE", { channels: ["nodes", "values"] });
```

Use the acknowledgement callback to get the current set of active subscriptions:

```js
socket.emit("SUBSCRIBE", { channels: ["nodes", "values"] }, (data) => {
  console.log("Subscribed to:", data.channels);
  // e.g. ['nodes', 'values']
});
```

Subscriptions are **additive** &mdash; calling `SUBSCRIBE` again adds to existing subscriptions rather than replacing them:

```js
// Already subscribed to ['nodes', 'values']
socket.emit("SUBSCRIBE", { channels: ["statistics"] });
// Now subscribed to ['nodes', 'values', 'statistics']
```

### Unsubscribing

Send an `UNSUBSCRIBE` event to remove specific channels:

```js
socket.emit("UNSUBSCRIBE", { channels: ["statistics"] });
```

The acknowledgement callback returns the updated subscription list.

### Subscribe to all channels

Use the special keyword `all` to subscribe to every available channel:

```js
socket.emit("SUBSCRIBE", { channels: ["all"] });
```

## Available channels

| Channel | Events | Description |
| --- | --- | --- |
| `controller` | `CONTROLLER_CMD`, `CONNECTED`, `INFO` | Controller status, connection state, app info |
| `nodes` | `NODE_FOUND`, `NODE_ADDED`, `NODE_REMOVED`, `NODE_UPDATED`, `NODE_EVENT`, `GRANT_SECURITY_CLASSES`, `VALIDATE_DSK`, `INCLUSION_ABORTED` | Node lifecycle, inclusion/exclusion, security negotiation |
| `values` | `VALUE_UPDATED`, `VALUE_REMOVED`, `METADATA_UPDATED` | Value changes (sensors, switches, battery, etc.) |
| `statistics` | `STATISTICS` | Node and driver communication statistics |
| `firmware` | `OTW_FIRMWARE_UPDATE` | Over-the-wire firmware update progress |
| `debug` | `DEBUG` | Debug log stream (high volume) |
| `znifferFrames` | `ZNIFFER_FRAME` | Z-Wave RF frame capture (very high volume) |
| `znifferState` | `ZNIFFER_STATE` | Zniffer state changes (low volume) |
| `rebuild` | `REBUILD_ROUTES_PROGRESS` | Network route rebuild progress |
| `diagnostics` | `HEALTH_CHECK_PROGRESS`, `LINK_RELIABILITY` | Node health check and link reliability test progress |

### Events not requiring subscriptions

These events are always delivered directly to the requesting socket and do not require channel subscriptions:

| Event | Description |
| --- | --- |
| `INIT` | Initial state event; not guaranteed on every connection. Use the `INITED` acknowledgement callback to reliably fetch the initial snapshot. |
| `API_RETURN` | Response to a `ZWAVE_API` call (delivered via callback) |

## Example: minimal external client

A script that only needs to track node changes:

```js
import { io } from "socket.io-client";

const socket = io("http://localhost:8091");

socket.on("connect", () => {
  // Subscribe only to what we need
  socket.emit("SUBSCRIBE", { channels: ["nodes"] });

  // Request initial state
  socket.emit("INITED", true, (state) => {
    console.log("Initial nodes:", Object.keys(state.nodes).length);
  });
});

socket.on("NODE_UPDATED", (node) => {
  console.log(`Node ${node.id} updated: ${node.name} (${node.status})`);
});

socket.on("NODE_ADDED", (node) => {
  console.log(`Node added: ${node.id}`);
});

socket.on("NODE_REMOVED", (node) => {
  console.log(`Node removed: ${node.id}`);
});
```

This client will **not** receive `VALUE_UPDATED`, `STATISTICS`, `DEBUG`, `ZNIFFER_FRAME`, or any other events outside the `nodes` channel.

## Calling Z-Wave APIs

You can call Z-Wave APIs through the socket:

```js
socket.emit("ZWAVE_API", { api: "setNodeName", args: [2, "Living Room"] }, (result) => {
  console.log(result.success ? "Name updated" : result.message);
});
```

The callback receives the result directly &mdash; no subscription is needed for API responses.

## Recommended subscriptions by use case

| Use case | Channels |
| --- | --- |
| Home automation sync (node names, status) | `nodes` |
| Full node monitoring (names, values, battery) | `nodes`, `values` |
| Dashboard (all live data) | `controller`, `nodes`, `values`, `statistics` |
| Debugging | `debug` |
| RF analysis | `znifferFrames`, `znifferState` |
| Everything (same as the web UI) | `all` |
