# Using MQTT

You have access to almost all of the [Z-Wave JS APIs](https://zwave-js.github.io/node-zwave-js/#/README) (and more) via MQTT.

## Z-Wave Events

If the **Send Z-Wave Events** flag of Gateway settings is enabled all Z-Wave JS events are published to MQTT. There are [Driver](https://zwave-js.github.io/node-zwave-js/#/api/driver?id=driver-events), [Node](https://zwave-js.github.io/node-zwave-js/#/api/node?id=zwavenode-events) and [Controller](https://zwave-js.github.io/node-zwave-js/#/api/node?id=controller-events) events

Topic

`<mqtt_prefix>/_EVENTS_/ZWAVE_GATEWAY-<mqtt_name>/<driver|node|controller>/<event_name>`

Payload

```js
{
  "data": [ ...eventArgs ] // an array containing all args in order
}
```

## Z-Wave APIs

To call a Z-Wave API you just need to publish a JSON object like:

```json
{
  "args": [2, 1]
}
```

Where `args` is an array with the args used to call the api, the topic is:

`<mqtt_prefix>/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/api/<api_name>/set`

The result will be published on the same topic without `/set`

### APIs

This are the available APIs:

- All Z-Wave Clients scene management methods preceeded by a `_` will use the internal scenes management instead of Z-Wave JS scenes:
  - `_createScene(label)`
  - `_removeScene(sceneId)`
  - `_setScenes(scenes[])`: Imports scenes Array in `scenes.json`
  - `_getScenes()`: Get the scenes array
  - `_sceneGetValues(sceneId)`: Return all values of the scene with given `sceneid`
  - `_addSceneValue(sceneId, valueId, value, timeout)`: Add a value to a specific scene
  - `_removeSceneValue(sceneId, valueId)`: remove a valueId from a scene
  - `_activateScene(sceneId)`: activate a scene
- `setNodeName(name)` and `setNodeLocation(location)` will use the internal nodes store to save node names/locations in a json file, and it will also try to store this info on the controller
- `refreshNeighborns()`: Returns an Array where the Array index is the `nodeId`, array value is an Array with all the ids of the node neighborns
- `getNodes()`: Returns an array with all nodes in the network (and their info/valueids)
- `getInfo()`: Returns an object with:
  - `homeid`: homeId
  - `name`: homeId Hex
  - `version`: Z-Wave JS version
  - `uptime`: Seconds from when the app process is started. It's the result of `process.uptime()`
  - `lastUpdate`: Timestamp of latest event received
  - `status`: Client status. Could be: 'driverReady', 'connected', 'scanDone', 'driverFailed', 'closed'
  - `cntStatus`: The controller status
- `getAssociations(nodeId, groupId)`: Get an array of current [associations](https://zwave-js.github.io/node-zwave-js/#/api/controller?id=association-interface) of a specific group
- `addAssociations(nodeId, groupId, associations)`: add a node to the array of specified [associations](https://zwave-js.github.io/node-zwave-js/#/api/controller?id=association-interface)
- `removeAssociations(nodeId, groupId, associations[])`: the opposite of add associations
- `removeAllAssociations(nodeId)`: Remove all associations of a specific node
- `removeNodeFromAllAssociations(nodeId)`: Remove a node from all associations
- `refreshValues(nodeId)`: Refresh all node values
- `refreshCCValues(nodeId, cc)`: Refresh all node values of a specific CC
- `pingNode(nodeId)`: Ping a node
- `pollValue(valueId)`: Polls a value from the node
- `startInclusion(inclusionStrategy, options)`: Starts the inclusion
- `startExclusion()`: Starts the exclusion
- `stopInclusion()`: Stops the inclusion
- `stopExclusion()`: Stops the exclusion
- `grantSecurityClasses(requested)`: Used to resolve the S2 userCallback promise
- `validateDSK(dsk)`: Used to resolve the S2 userCallback promise
- `abortInclusion()`: Aborts any active S2 inclusion process
- `replaceFailedNode(nodeId, inclusionStrategy)`: Replace a failed node
- `hardReset()`: Hard reset the controller
- `healNode(nodeId)`: Heal a specific node
- `beginHealingNetwork()`: Starts healing the network
- `stopHealingNetwork()`: Stops network healing
- `isFailedNode(nodeId)`: Checks if a node is failed
- `removeFailedNode(nodeId)`: Remove a failed node
- `refreshInfo(nodeId)`: Re-interview a node to fetch its info and supported CCs
- `beginFirmwareUpdate(nodeId, fileName, data, target)`: Starts a firmware update of a node. The `fileName` is used to check the extension (used to detect the firmware file type) and data is a `Buffer`
- `abortFirmwareUpdate(nodeId)`: Aborts a firmware update
- `writeValue(valueId, value, options)`: Write a specific value to a [valueId](https://zwave-js.github.io/node-zwave-js/#/api/valueid?id=valueid) with optional options (ex: `{"transitionDuration": "10s"}`)
- `writeBroadcast(valueId, value)`: Send a broadcast request to all nodes that support [valueId](https://zwave-js.github.io/node-zwave-js/#/api/valueid?id=valueid)
- `writeMulticast(nodes, valueId, value)`: Send a multicast request to all `nodes` provided that support [valueId](https://zwave-js.github.io/node-zwave-js/#/api/valueid?id=valueid)
- `sendCommand(ctx, command, args)`: Send a custom command.
  - `ctx`: context to get the instance to send the command (`{ nodeId: number, endpoint: number, commandClass: number }`)
  - `command`: the command name. Check available commands by selecting a CC [here](https://zwave-js.github.io/node-zwave-js/#/api/CCs/index)
  - `args`: array of arguments to pass to the command
- `restart()`: restart client
- `backupNVMRaw()`: Backup the NVM raw data
- `restoreNVM(data)`: Restore the NVM data. If the given buffer is in a different NVM format, it is converted automatically. If the conversion is not supported, the operation fails.
- `softReset`: Soft reset the controller (restart)
- `driverFunction(code)`: Execute a driver function. The function `this` allow to access `zwaveClient` instance and `require` (ex: `this.zwaveClient` and `this.require`). The only parameter of the function is `driver`. It's like execute this:

```js
function(driver) {
  // your code here
}
```

Examples:

```js
const fs = this.require("fs-extra")
const { storeDir } = this.require('../config/app')
const data = await driver.controller.backupNVMRaw()
await fs.writeFile(storeDir + '/NVM.bin', data, 'binary')
```

```js
const node = driver.controller.nodes.get(35);
await node.refreshInfo();
```

### Api call examples

#### Get Associations

Get all of the associations of node `23` and the group `Lifeline` (groupId `1`)

Topic: `zwave/_CLIENTS/ZWAVE_GATEWAY-office/api/getAssociations/set`

Payload:

```js
{
  "args": [
    23, // nodeid
    1 // lifeline group id
  ]
}
```

You will get this response (in the same topic without the suffix `/set`):

```js
{
  "success": true,
  "message": "Success zwave api call",
  "result": [1] // the controller id
}
```

`result` will contain the value returned from the API. In this example you will get an array with all node IDs that are associated to the group 1 (lifeline) of node 23.

#### Execute Scene

Execute the scene with the id `1` via mqtt.

Topic: `zwave/_CLIENTS/ZWAVE_GATEWAY-office/api/_activateScene/set`

Payload:

```js
{
  "args": [
    1 // id of scene
  ]
}
```

#### Send Command

Example calling [startLevelChange](https://github.com/zwave-js/node-zwave-js/blob/c695ee81cb2b1d3cf15e3db1cc14b1e41a911cc0/packages/zwave-js/src/lib/commandclass/MultilevelSwitchCC.ts) command:

Topic: `zwavejs/_CLIENTS/ZWAVE_GATEWAY-<yourName>/api/sendCommand/set`

Payload:

```js
{ "args": [
  {
    "nodeId": 23,
    "commandClass": 38,
    "endpoint": 0,
  },
  "startLevelChange",
  [{}] // this are the args, in this case it could be omitted
  ]
}
```

## Set values

To write a value using MQTT you need to send the value to the /set API in the same topic where the value updates are published, by adding the suffix `/set` to the topic.

To set the light dimmer of the node named `light` and location `office` to `100`.

`zwave/office/test/38/0/targetValue/set`

Payload:

```json
{
  "value": 100
}
```

 To check if the value has been successfully write just check when the value changes on the topic:

`zwave/office/test/38/0/targetValue`

In this case the Command Class 38 (Multilevel Switch) also has a `currentValue` property that rappresents the current value of the device, MQTT also allows you to write to this valueId even if it is marked as read-only because it will redirect the write request to the associated `targetValue`. So the same payload sent to:

`zwave/office/test/38/0/currentValue/set`

Will work in the same way.

### Set with options

If you would like to send a write request with options like `transitionDurtation` and `volume` you can do it by using a JSON payload:

Topic: `zwave/office/light/38/0/targetValue`

Payload:

```json
{
  "value": 100,
  "options": {
    "transitionDuration": "5s"
  }
}
```

## Broadcast

You can send two kind of broadcast requests:

1. Send it to _all values with a specific suffix_ in the network.

> [!NOTE]
> This creates a LOT of traffic and can have a significant performance impact.

Topic: `<mqtt_prefix>/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/broadcast/<value_topic_suffix>/set`

- `value_topic_suffix`: the suffix of the topic of the value you want to control using broadcast.

It works like the set value API without the node name and location properties.
If the API is correctly called the same payload of the request will be published
to the topic without `/set` suffix.

Example of broadcast command (gateway configured as `named topics`):

`zwave/_CLIENTS/ZWAVE_GATEWAY-test/broadcast/38/0/targetValue/set`

Payload: `25.5`

All nodes with a valueId **Command class** `38` (Multilevel Switch), **Endpoint** `0` will receive a write request of value `25.5` to **property** `targetValue` and will get the same value (as feedback) on the topic:

`zwave/_CLIENTS/ZWAVE_GATEWAY-test/broadcast/38/0/targetValue`

1. Send a real zwave [broadcast](https://zwave-js.github.io/node-zwave-js/#/api/controller?id=getbroadcastnode) request

Topic: `<mqtt_prefix>/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/broadcast/set`
Payload:

```js
{
  "commandClass": 38,
  "endpoint": 0,
  "property": "targetValue",
  "value": 80
}
```

## Multicast

Send a [multicast](https://zwave-js.github.io/node-zwave-js/#/api/controller?id=getmulticastgroup) request to all nodes specified in the array in the payload. If this fails because it's not supported a fallback will try to send multiple single requests.

> [!NOTE]
> Multicast requests have no delay between individual nodes reactions

Topic: `<mqtt_prefix>/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/multicast/set`
Payload:

```js
{
  "nodes": [2, 3, 4, 6]
  "commandClass": 38,
  "endpoint": 0,
  "property": "targetValue",
  "value": 80
}
```

## Special topics

### App version

`<mqtt_prefix>/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/version`

The payload will be in the time-value json format and the value will contain the app string version.

### Mqtt status

`<mqtt_prefix>/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/status`

The payload will be in the time-value json format and the value will be `true` when mqtt is connected, `false` otherwise.

### Node status

`<mqtt_prefix>/<?node_location>/<node_name>/status`

The payload will be `true` if node is ready `false` otherwise. If the payload is in JSON format it will also contain the node status string in `status` property (`Alive`, `Awake`, `Dead`).

### Node information

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
  "firmwareVersion": "3.3",
  "supportsBeaming": true,
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

### Node notifications

Node notifications are translated to valueIds based on the CC that is triggering the notification and the notification args. Topic and payload depends on your gateway settings.

#### Entry CC

ValueId:

```js
 {
    ...
    property: args.eventType
    propertyKey: args.dataType
  }
```

Data: `args.eventData`

#### Notification CC

ValueId:

```js
 {
    ...
    property: args.label
    propertyKey: args.eventLabel
  }
```

Data: `args.parameters`

## Buffer payloads

When an MQTT message contains a value of type `Buffer`, such as an Api call argument or return value, the buffer's content is represented as a JSON object of this form:

```json
{ type: "Buffer", data: [1, 2, 3] }
```
