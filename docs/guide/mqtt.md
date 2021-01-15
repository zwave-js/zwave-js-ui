# MQTT

You have full access to all [zwavejs APIs](https://zwave-js.github.io/node-zwave-js/#/README) (and more) by simply using MQTT.

## Zwave Events

If **Send Zwave Events** flag of Gateway settings is enabled all Zwave-js events are published to MQTT. There are [Driver](https://zwave-js.github.io/node-zwave-js/#/api/driver?id=driver-events), [Node](https://zwave-js.github.io/node-zwave-js/#/api/node?id=zwavenode-events) and [Controller](https://zwave-js.github.io/node-zwave-js/#/api/node?id=controller-events) events

Topic

`<mqtt_prefix>/_EVENTS_/ZWAVE_GATEWAY-<mqtt_name>/<driver|node|controller>/<event_name>`

Payload

```js
{
  "data": [ ...eventArgs ] // an array containing all args in order
}
```

## Zwave APIs

To call a Zwave API you just need to publish a JSON object like:

```json
{
  "args": [2, 1]
}
```

Where `args` is an array with the args used to call the api, the topic is:

`<mqtt_prefix>/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/api/<api_name>/set`

The result will be published on the same topic without `/set`

Example: If I publish the previous json object to the topic

`zwave/_CLIENTS/ZWAVE_GATEWAY-office/api/getAssociations/set`

I will get this response (in the same topic without the suffix `/set`):

```json
{
  "success": true,
  "message": "Success zwave api call",
  "result": [1]
}
```

`result` will contain the value returned from the API. In this example I will get an array with all node IDs that are associated to the group 1 (lifeline) of node 2.

### Custom APIs

There are some custom apis that can be called that are not part of Zwave Client:

- All Zwave Clients scenes management methods if preceeded by a `_` will use the internal scenes management instead of OZW scenes:
  - `_createScene`
  - `_removeScene`
  - `_setScenes`
  - `_getScenes`
  - `_sceneGetValues`
  - `_addSceneValue`
  - `_removeSceneValue`
  - `_activateScene`
- `_setNodeName` and `_setNodeLocation` will use internal nodes store to save nodes names/locations in a json file
- `refreshNeighborns`: Returns an Array, the Array index is the nodeId, array value is an Array with all node neighborns
- `getNodes`: Returns an array with all nodes in the network (and their info/valueids)
- `getInfo`: Returns an object with:
  - `homeid`: homeId
  - `name`: homeId Hex
  - `version`: zwave-js version
  - `uptime`: Seconds from when the app process is started. It's the result of `process.uptime()`
  - `lastUpdate`: Timestamp of latest event received from OZW
  - `status`: Client status. Could be: 'driverReady', 'connected', 'scanDone', 'driverFailed', 'closed'
  - `cntStatus`: Controller status received from ozw notifications controller command. If inclusion/exclusion is running it would be `Waiting`

## Set values

To write a value using MQTT you just need to send the value to set in the same topic where the value updates are published by adding the suffix `/set` to the topic (**READONLY VALUES CANNOT BE WRITE**).

Example with gateway configured with `named topics`:

If I publish the value `25.5` (also a payload with a JSON object with the value in `value` property is accepted) to the topic

`zwave/office/nodeID_4/thermostat_setpoint/heating/set`

I will set the Heating setpoint of the node with id `4` located in the `office` to `25.5`. To check if the value has been successfully write just check when the value changes on the topic:

`zwave/office/nodeID_4/thermostat_setpoint/heating`

## Broadcast

You can send broadcast values to _all values with a specific suffix_ in the network.

Broadcast API is accessible from:

`<mqtt_prefix>/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/broadcast/<value_topic_suffix>/set`

- `value_topic_suffix`: the suffix of the topic of the value I want to control using broadcast.

  It works like the set value API without the node name and location properties.
  If the API is correctly called the same payload of the request will be published
  to the topic without `/set` suffix.

  Example of broadcast command (gateway configured as `named topics`):

  `zwave/_CLIENTS/ZWAVE_GATEWAY-test/broadcast/thermostat_setpoint/heating/set`

  Payload: `25.5`

  All nodes with command class `thermostat_setpoint` and value `heating` will be set to `25.5` and I will get the same value on the topic:

  `zwave/_CLIENTS/ZWAVE_GATEWAY-test/broadcast/thermostat_setpoint/heating`

## Special topics

- **App version**:

  `<mqtt_prefix>/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/version`

  The payload will be in the time-value json format and the value will contain the app string version.

- **Mqtt status**:

  `<mqtt_prefix>/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/status`

  The payload will be in the time-value json format and the value will be `true` when mqtt is connected, `false` otherwise.

- **Node status**:

  `<mqtt_prefix>/<?node_location>/<node_name>/status`

  The payload will be `true` if node is ready `false` otherwise. If the payload is in JSON format it will also contain the node status string in `status` property (`Alive`, `Awake`, `Dead`)

- **Node information**:

  `<mqtt_prefix>/<?node_location>/<node_name>/nodeinfo`

  Payload includes all node details except Discovered devices, values and properties.
  Updates on every node change.

  A example of payload is:

  ```json
  {
    "id": 97,
    "deviceId": "271-4098-2049",
    "manufacturer": "Fibargroup",
    "manufacturerId": 271,
    "productType": 2049,
    "productId": 4098,
    "name": "Sensor",
    "loc": "Hallway",
    "neighbors": [29, 43, 63, 64, 65, 66, 67, 72, 74, 86],
    "ready": true,
    "available": true,
    "failed": false,
    "lastActive": 1610009585743,
    "interviewCompleted": true,
    "firmwareVersion": "3.3",
    "isBeaming": true,
    "isSecure": false,
    "keepAwake": false,
    "maxBaudRate": null,
    "isRouting": true,
    "isFrequentListening": false,
    "isListening": false,
    "status": "Asleep",
    "interviewStage": "Complete",
    "productLabel": "FGMS001",
    "productDescription": "Motion Sensor",
    "zwaveVersion": 4,
    "deviceClass": {
      "basic": 4,
      "generic": 7,
      "specific": 1
    },
    "hexId": "0x010f-0x1002-0x0801"
  }
  ```

- **Node notifications**:

  `<mqtt_prefix>/<?node_location>/<node_name>/notification/<notificationLabel>`

  The payload will be the notification `parameters` (can be null or not based on the notification type)
