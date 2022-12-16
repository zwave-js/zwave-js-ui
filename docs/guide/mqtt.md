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

<!-- AUTO GENERATED START -->
#### `restart`

```ts
async restart(): Promise<void>;
```

Restart client connection.

#### `getAssociations`

```ts
getAssociations(nodeId: number): ZUIGroupAssociation[];
```

Get current associations of a specific group.

#### `addAssociations`

```ts
async addAssociations(
	source: AssociationAddress,
	groupId: number,
	associations: AssociationAddress[]
): Promise<void>;
```

Add a node to an association group.

#### `removeAssociations`

```ts
async removeAssociations(
	source: AssociationAddress,
	groupId: number,
	associations: AssociationAddress[]
): Promise<void>;
```

Remove a node from an association group.

#### `removeAllAssociations`

```ts
async removeAllAssociations(nodeId: number): Promise<void>;
```

Remove all associations.

#### `removeNodeFromAllAssociations`

```ts
async removeNodeFromAllAssociations(nodeId: number): Promise<void>;
```

Remove node from all associations.

#### `refreshNeighbors`

```ts
async refreshNeighbors(): Promise<Record<number, number[]>>;
```

Refresh all nodes neighbors.

#### `getNodeNeighbors`

```ts
getNodeNeighbors(
	nodeId: number,
	dontThrow: boolean
): Promise<readonly number[]>;
```

Get neighbors of a specific node.

#### `driverFunction`

```ts
driverFunction(code: string): Promise<any>;
```

Execute a custom function with the driver.

#### `setNodeName`

```ts
async setNodeName(nodeid: number, name: string): Promise<boolean>;
```

Updates node `name` property and stores updated config in `nodes.json`.

#### `setNodeLocation`

```ts
async setNodeLocation(nodeid: number, loc: string): Promise<boolean>;
```

Updates node `loc` property and stores updated config in `nodes.json`.

#### `_createScene`

```ts
async _createScene(label: string): Promise<boolean>;
```

Creates a new scene with a specific `label` and stores it in `scenes.json`.

#### `_removeScene`

```ts
async _removeScene(sceneid: number): Promise<boolean>;
```

Delete a scene with a specific `sceneid` and updates `scenes.json`.

#### `_setScenes`

```ts
async _setScenes(scenes: ZUIScene[]): Promise<ZUIScene[]>;
```

Imports scenes Array in `scenes.json`.

#### `_getScenes`

```ts
_getScenes(): ZUIScene[];
```

Get all scenes.

#### `_sceneGetValues`

```ts
_sceneGetValues(sceneid: number): ZUIValueIdScene[];
```

Return all values of the scene with given `sceneid`.

#### `_addSceneValue`

```ts
async _addSceneValue(
	sceneid: number,
	valueId: ZUIValueIdScene,
	value: any,
	timeout: number
): Promise<any>;
```

Add a value to a scene.

#### `_removeSceneValue`

```ts
async _removeSceneValue(sceneid: number, valueId: ZUIValueIdScene): Promise<any>;
```

Remove a value from scene.

#### `_activateScene`

```ts
_activateScene(sceneId: number): boolean;
```

Activate a scene with given scene id.

#### `getNodes`

```ts
getNodes(): ZUINode[];
```

Get the nodes array.

#### `getInfo`

```ts
getInfo(): ZUIDriverInfo;
```

#### `refreshValues`

```ts
refreshValues(nodeId: number): Promise<void>;
```

Refresh all node values.

#### `pingNode`

```ts
pingNode(nodeId: number): Promise<boolean>;
```

Ping a node.

#### `refreshCCValues`

```ts
refreshCCValues(nodeId: number, cc: CommandClasses): Promise<void>;
```

Refresh all node values of a specific CC.

#### `checkForConfigUpdates`

```ts
async checkForConfigUpdates(): Promise<string | undefined>;
```

Checks for configs updates.

#### `installConfigUpdate`

```ts
async installConfigUpdate(): Promise<boolean>;
```

Checks for configs updates and installs them.

#### `pollValue`

```ts
pollValue(valueId: ZUIValueId): Promise<unknown>;
```

Request an update of this value.

#### `replaceFailedNode`

```ts
async replaceFailedNode(
	nodeId: number,
	strategy: InclusionStrategy = InclusionStrategy.Security_S2,
	options?: { qrString?: string; provisioning?: PlannedProvisioningEntry }
): Promise<boolean>;
```

Replace failed node.

#### `getAvailableFirmwareUpdates`

```ts
async getAvailableFirmwareUpdates(
	nodeId: number,
	options?: GetFirmwareUpdatesOptions
): Promise<import("/home/daniel/GitProjects/zwave-js-ui/node_modules/zwave-js/build/index").FirmwareUpdateInfo[]>;
```

#### `firmwareUpdateOTA`

```ts
async firmwareUpdateOTA(nodeId: number, updates: FirmwareUpdateFileInfo[]): Promise<boolean>;
```

#### `beginOTAFirmwareUpdate`

```ts
async beginOTAFirmwareUpdate(
	nodeId: number,
	update: FirmwareUpdateFileInfo
): Promise<void>;
```

.

#### `setPowerlevel`

```ts
async setPowerlevel(
	powerlevel: number,
	measured0dBm: number
): Promise<boolean>;
```

#### `setRFRegion`

```ts
async setRFRegion(region: RFRegion): Promise<boolean>;
```

#### `startInclusion`

```ts
async startInclusion(
	strategy: InclusionStrategy = InclusionStrategy.Default,
	options?: {
		forceSecurity?: boolean
		provisioning?: PlannedProvisioningEntry
		qrString?: string
		name?: string
		location?: string
	}
): Promise<boolean>;
```

Start inclusion.

#### `startExclusion`

```ts
async startExclusion(
	options: ExclusionOptions = {
		strategy: ExclusionStrategy.DisableProvisioningEntry,
	}
): Promise<boolean>;
```

Start exclusion.

#### `stopExclusion`

```ts
stopExclusion(): Promise<boolean>;
```

Stop exclusion.

#### `stopInclusion`

```ts
stopInclusion(): Promise<boolean>;
```

Stops inclusion.

#### `healNode`

```ts
async healNode(nodeId: number): Promise<boolean>;
```

Heal a node.

#### `checkLifelineHealth`

```ts
async checkLifelineHealth(
	nodeId: number,
	rounds = 5
): Promise<LifelineHealthCheckSummary & { targetNodeId: number }>;
```

Check node lifeline health.

#### `checkRouteHealth`

```ts
async checkRouteHealth(
	nodeId: number,
	targetNodeId: number,
	rounds = 5
): Promise<RouteHealthCheckSummary & { targetNodeId: number }>;
```

Check node routes health.

#### `isFailedNode`

```ts
async isFailedNode(nodeId: number): Promise<boolean>;
```

Check if a node is failed.

#### `removeFailedNode`

```ts
async removeFailedNode(nodeId: number): Promise<void>;
```

Remove a failed node.

#### `refreshInfo`

```ts
refreshInfo(nodeId: number, options?: RefreshInfoOptions): Promise<void>;
```

Re interview the node.

#### `updateFirmware`

```ts
updateFirmware(nodeId: number, files: FwFile[]): Promise<boolean>;
```

#### `beginFirmwareUpdate`

```ts
beginFirmwareUpdate(
	nodeId: number,
	fileName: string,
	data: Buffer,
	target: number
): Promise<void>;
```

Start a firmware update.

#### `abortFirmwareUpdate`

```ts
async abortFirmwareUpdate(nodeId: number): Promise<void>;
```

#### `beginHealingNetwork`

```ts
beginHealingNetwork(): boolean;
```

#### `stopHealingNetwork`

```ts
stopHealingNetwork(): boolean;
```

#### `hardReset`

```ts
async hardReset(): Promise<void>;
```

#### `softReset`

```ts
softReset(): Promise<void>;
```

#### `sendCommand`

```ts
async sendCommand(
	ctx: {
		nodeId: number
		endpoint: number
		commandClass: CommandClasses | keyof typeof CommandClasses
	},
	command: string,
	args: any[]
): Promise<any>;
```

Send a command.

#### `writeBroadcast`

```ts
async writeBroadcast(valueId: ValueID, value: unknown): Promise<void>;
```

Send broadcast write request.

#### `writeMulticast`

```ts
async writeMulticast(nodes: number[], valueId: ZUIValueId, value: unknown): Promise<void>;
```

Send multicast write request to a group of nodes.

#### `writeValue`

```ts
async writeValue(
	valueId: ZUIValueId,
	value: any,
	options?: SetValueAPIOptions
): Promise<boolean>;
```

Set a value of a specific zwave valueId.

#### `grantSecurityClasses`

```ts
grantSecurityClasses(requested: InclusionGrant): void;
```

#### `validateDSK`

```ts
validateDSK(dsk: string): void;
```

#### `abortInclusion`

```ts
abortInclusion(): void;
```

#### `backupNVMRaw`

```ts
async backupNVMRaw(): Promise<{ data: Buffer; fileName: string; }>;
```

#### `restoreNVM`

```ts
async restoreNVM(data: Buffer): Promise<void>;
```

#### `getProvisioningEntries`

```ts
async getProvisioningEntries(): Promise<SmartStartProvisioningEntry[]>;
```

#### `getProvisioningEntry`

```ts
getProvisioningEntry(dsk: string): SmartStartProvisioningEntry | undefined;
```

#### `unprovisionSmartStartNode`

```ts
unprovisionSmartStartNode(dskOrNodeId: string | number): void;
```

#### `parseQRCodeString`

```ts
parseQRCodeString(qrString: string): {
	parsed?: QRProvisioningInformation
	nodeId?: number
	exists: boolean
};
```

#### `provisionSmartStartNode`

```ts
provisionSmartStartNode(entry: PlannedProvisioningEntry | string): void;
```

#### `updateControllerNodeProps`

```ts
async updateControllerNodeProps(
	node?: ZUINode,
	props: Array<'powerlevel' | 'RFRegion'> = ['powerlevel', 'RFRegion']
): Promise<void>;
```
<!-- AUTO GENERATED END -->

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

To write a value using MQTT you need to send a packet to the same topic where the value updates are published and adding the suffix `/set`.

Example:

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

### Example setting a value

Here is an example of sending a set command to a valueId using [MQTT Explorer](http://mqtt-explorer.com/)

![MQTT Explorer](../_images/mqtt-explorer.mp4 ':include :type=video controls width=100% height=400px')

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

### MQTT status

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
{ "type": "Buffer", "data": [1, 2, 3] }
```
