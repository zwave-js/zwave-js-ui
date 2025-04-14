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

### Api call examples

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
{ 
	"args": [
		{
			"nodeId": 23,
			"commandClass": 38,
			"endpoint": 0,
		},
		"startLevelChange",
		[{ duration: "1m"}] // this are the args of the command
  ]
}
```

### APIs

This are the available APIs:

<!-- AUTO GENERATED START -->
#### `restart`

```ts
async restart(): Promise<void>;
```

Restart client connection.

<details>
<summary>Mqtt usage</summary>

Topic: `zwave/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/api/restart/set`

Payload:

```json
{
	"args": []
}
```

</details>

#### `getSchedules`

```ts
async getSchedules(
	nodeId: number,
	opts: { mode?: ZUIScheduleEntryLockMode; fromCache: boolean } = {
		fromCache: true,
	},
): Promise<ZUISchedule>;
```

If the node supports Schedule Lock CC parses all available schedules and cache them.

<details>
<summary>Mqtt usage</summary>

Topic: `zwave/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/api/getSchedules/set`

Payload:

```json
{
	"args": [
		nodeId,
		opts
	]
}
```

</details>

#### `cancelGetSchedule`

```ts
cancelGetSchedule(): void;
```

<details>
<summary>Mqtt usage</summary>

Topic: `zwave/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/api/cancelGetSchedule/set`

Payload:

```json
{
	"args": []
}
```

</details>

#### `setSchedule`

```ts
async setSchedule(
	nodeId: number,
	type: 'daily' | 'weekly' | 'yearly',
	schedule: ScheduleEntryLockSlotId &
		(
			| ScheduleEntryLockDailyRepeatingSchedule
			| ScheduleEntryLockWeekDaySchedule
			| ScheduleEntryLockYearDaySchedule
		),
): Promise<SupervisionResult>;
```

<details>
<summary>Mqtt usage</summary>

Topic: `zwave/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/api/setSchedule/set`

Payload:

```json
{
	"args": [
		nodeId,
		type,
		schedule
	]
}
```

</details>

#### `setEnabledSchedule`

```ts
async setEnabledSchedule(nodeId: number, enabled: boolean, userId: number): Promise<SupervisionResult>;
```

<details>
<summary>Mqtt usage</summary>

Topic: `zwave/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/api/setEnabledSchedule/set`

Payload:

```json
{
	"args": [
		nodeId,
		enabled,
		userId
	]
}
```

</details>

#### `getAssociations`

```ts
async getAssociations(
	nodeId: number,
	refresh = false,
): Promise<ZUIGroupAssociation[]>;
```

Get an array of current [associations](https://zwave-js.github.io/node-zwave-js/#/api/controller?id=association-interface) of a specific group.

<details>
<summary>Mqtt usage</summary>

Topic: `zwave/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/api/getAssociations/set`

Payload:

```json
{
	"args": [
		nodeId,
		refresh
	]
}
```

</details>

#### `addAssociations`

```ts
async addAssociations(
	source: AssociationAddress,
	groupId: number,
	associations: AssociationAddress[],
): Promise<boolean>;
```

Add a node to the array of specified [associations](https://zwave-js.github.io/node-zwave-js/#/api/controller?id=association-interface).

<details>
<summary>Mqtt usage</summary>

Topic: `zwave/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/api/addAssociations/set`

Payload:

```json
{
	"args": [
		source,
		groupId,
		associations
	]
}
```

</details>

#### `removeAssociations`

```ts
async removeAssociations(
	source: AssociationAddress,
	groupId: number,
	associations: AssociationAddress[],
): Promise<void>;
```

Remove a node from an association group.

<details>
<summary>Mqtt usage</summary>

Topic: `zwave/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/api/removeAssociations/set`

Payload:

```json
{
	"args": [
		source,
		groupId,
		associations
	]
}
```

</details>

#### `removeAllAssociations`

```ts
async removeAllAssociations(nodeId: number): Promise<void>;
```

Remove all associations.

<details>
<summary>Mqtt usage</summary>

Topic: `zwave/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/api/removeAllAssociations/set`

Payload:

```json
{
	"args": [
		nodeId
	]
}
```

</details>

#### `syncNodeDateAndTime`

```ts
syncNodeDateAndTime(nodeId: number, date = new Date()): Promise<boolean>;
```

Setting the date and time on a node could be hard, this helper method will set it using the date provided (default to now).

The following CCs will be used (when supported or necessary) in this process:

- Time Parameters CC
- Clock CC
- Time CC
- Schedule Entry Lock CC (for setting the timezone).

<details>
<summary>Mqtt usage</summary>

Topic: `zwave/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/api/syncNodeDateAndTime/set`

Payload:

```json
{
	"args": [
		nodeId,
		date
	]
}
```

</details>

#### `manuallyIdleNotificationValue`

```ts
manuallyIdleNotificationValue(valueId: ZUIValueId): void;
```

<details>
<summary>Mqtt usage</summary>

Topic: `zwave/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/api/manuallyIdleNotificationValue/set`

Payload:

```json
{
	"args": [
		valueId
	]
}
```

</details>

#### `removeNodeFromAllAssociations`

```ts
async removeNodeFromAllAssociations(nodeId: number): Promise<void>;
```

Remove node from all associations.

<details>
<summary>Mqtt usage</summary>

Topic: `zwave/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/api/removeNodeFromAllAssociations/set`

Payload:

```json
{
	"args": [
		nodeId
	]
}
```

</details>

#### `refreshNeighbors`

```ts
async refreshNeighbors(): Promise<Record<number, number[]>>;
```

Refresh all nodes neighbors.

<details>
<summary>Mqtt usage</summary>

Topic: `zwave/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/api/refreshNeighbors/set`

Payload:

```json
{
	"args": []
}
```

</details>

#### `getNodeNeighbors`

```ts
async getNodeNeighbors(
	nodeId: number,
	preventThrow = false,
	emitNodeUpdate = true,
): Promise<readonly number[]>;
```

Get neighbors of a specific node.

<details>
<summary>Mqtt usage</summary>

Topic: `zwave/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/api/getNodeNeighbors/set`

Payload:

```json
{
	"args": [
		nodeId,
		preventThrow,
		emitNodeUpdate
	]
}
```

</details>

#### `discoverNodeNeighbors`

```ts
async discoverNodeNeighbors(nodeId: number): Promise<boolean>;
```

Instructs a node to (re-)discover its neighbors.

<details>
<summary>Mqtt usage</summary>

Topic: `zwave/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/api/discoverNodeNeighbors/set`

Payload:

```json
{
	"args": [
		nodeId
	]
}
```

</details>

#### `driverFunction`

```ts
driverFunction(code: string): Promise<any>;
```

Execute a driver function.
More info [here](/usage/driver_function?id=driver-function).

<details>
<summary>Mqtt usage</summary>

Topic: `zwave/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/api/driverFunction/set`

Payload:

```json
{
	"args": [
		code
	]
}
```

</details>

#### `setNodeName`

```ts
async setNodeName(nodeid: number, name: string): Promise<boolean>;
```

Updates node `name` property and stores updated config in `nodes.json`.

<details>
<summary>Mqtt usage</summary>

Topic: `zwave/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/api/setNodeName/set`

Payload:

```json
{
	"args": [
		nodeid,
		name
	]
}
```

</details>

#### `setNodeLocation`

```ts
async setNodeLocation(nodeid: number, loc: string): Promise<boolean>;
```

Updates node `loc` property and stores updated config in `nodes.json`.

<details>
<summary>Mqtt usage</summary>

Topic: `zwave/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/api/setNodeLocation/set`

Payload:

```json
{
	"args": [
		nodeid,
		loc
	]
}
```

</details>

#### `setNodeDefaultSetValueOptions`

```ts
setNodeDefaultSetValueOptions(
	nodeId: number,
	props: Pick<ZUINode, 'defaultTransitionDuration' | 'defaultVolume'>,
): void;
```

<details>
<summary>Mqtt usage</summary>

Topic: `zwave/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/api/setNodeDefaultSetValueOptions/set`

Payload:

```json
{
	"args": [
		nodeId,
		props
	]
}
```

</details>

#### `_createScene`

```ts
async _createScene(label: string): Promise<boolean>;
```

Creates a new scene with a specific `label` and stores it in `scenes.json`.

<details>
<summary>Mqtt usage</summary>

Topic: `zwave/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/api/_createScene/set`

Payload:

```json
{
	"args": [
		label
	]
}
```

</details>

#### `_removeScene`

```ts
async _removeScene(sceneid: number): Promise<boolean>;
```

Delete a scene with a specific `sceneid` and updates `scenes.json`.

<details>
<summary>Mqtt usage</summary>

Topic: `zwave/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/api/_removeScene/set`

Payload:

```json
{
	"args": [
		sceneid
	]
}
```

</details>

#### `_setScenes`

```ts
async _setScenes(scenes: ZUIScene[]): Promise<ZUIScene[]>;
```

Imports scenes Array in `scenes.json`.

<details>
<summary>Mqtt usage</summary>

Topic: `zwave/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/api/_setScenes/set`

Payload:

```json
{
	"args": [
		scenes
	]
}
```

</details>

#### `_getScenes`

```ts
_getScenes(): ZUIScene[];
```

Get all scenes.

<details>
<summary>Mqtt usage</summary>

Topic: `zwave/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/api/_getScenes/set`

Payload:

```json
{
	"args": []
}
```

</details>

#### `_sceneGetValues`

```ts
_sceneGetValues(sceneid: number): ZUIValueIdScene[];
```

Return all values of the scene with given `sceneid`.

<details>
<summary>Mqtt usage</summary>

Topic: `zwave/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/api/_sceneGetValues/set`

Payload:

```json
{
	"args": [
		sceneid
	]
}
```

</details>

#### `_addSceneValue`

```ts
async _addSceneValue(
	sceneid: number,
	valueId: ZUIValueIdScene,
	value: any,
	timeout: number,
): Promise<any>;
```

Add a value to a scene.

<details>
<summary>Mqtt usage</summary>

Topic: `zwave/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/api/_addSceneValue/set`

Payload:

```json
{
	"args": [
		sceneid,
		valueId,
		value,
		timeout
	]
}
```

</details>

#### `_removeSceneValue`

```ts
async _removeSceneValue(sceneid: number, valueId: ZUIValueIdScene): Promise<any>;
```

Remove a value from scene.

<details>
<summary>Mqtt usage</summary>

Topic: `zwave/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/api/_removeSceneValue/set`

Payload:

```json
{
	"args": [
		sceneid,
		valueId
	]
}
```

</details>

#### `_activateScene`

```ts
_activateScene(sceneId: number): boolean;
```

Activate a scene with given scene id.

<details>
<summary>Mqtt usage</summary>

Topic: `zwave/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/api/_activateScene/set`

Payload:

```json
{
	"args": [
		sceneId
	]
}
```

</details>

#### `getNodes`

```ts
getNodes(): ZUINode[];
```

Get the nodes array.

<details>
<summary>Mqtt usage</summary>

Topic: `zwave/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/api/getNodes/set`

Payload:

```json
{
	"args": []
}
```

</details>

#### `getInfo`

```ts
getInfo(): ZUIDriverInfo;
```

<details>
<summary>Mqtt usage</summary>

Topic: `zwave/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/api/getInfo/set`

Payload:

```json
{
	"args": []
}
```

</details>

#### `refreshValues`

```ts
refreshValues(nodeId: number): Promise<void>;
```

Refresh all node values.

<details>
<summary>Mqtt usage</summary>

Topic: `zwave/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/api/refreshValues/set`

Payload:

```json
{
	"args": [
		nodeId
	]
}
```

</details>

#### `pingNode`

```ts
pingNode(nodeId: number): Promise<boolean>;
```

Ping a node.

<details>
<summary>Mqtt usage</summary>

Topic: `zwave/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/api/pingNode/set`

Payload:

```json
{
	"args": [
		nodeId
	]
}
```

</details>

#### `refreshCCValues`

```ts
refreshCCValues(nodeId: number, cc: CommandClasses): Promise<void>;
```

Refresh all node values of a specific CC.

<details>
<summary>Mqtt usage</summary>

Topic: `zwave/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/api/refreshCCValues/set`

Payload:

```json
{
	"args": [
		nodeId,
		cc
	]
}
```

</details>

#### `checkForConfigUpdates`

```ts
async checkForConfigUpdates(): Promise<string | undefined>;
```

Checks for configs updates.

<details>
<summary>Mqtt usage</summary>

Topic: `zwave/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/api/checkForConfigUpdates/set`

Payload:

```json
{
	"args": []
}
```

</details>

#### `installConfigUpdate`

```ts
async installConfigUpdate(): Promise<boolean>;
```

Checks for configs updates and installs them.

<details>
<summary>Mqtt usage</summary>

Topic: `zwave/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/api/installConfigUpdate/set`

Payload:

```json
{
	"args": []
}
```

</details>

#### `shutdownZwaveAPI`

```ts
async shutdownZwaveAPI(): Promise<boolean>;
```

If supported by the controller, this instructs it to shut down the Z-Wave API, so it can safely be removed from power. If this is successful (returns `true`), the driver instance will be destroyed and can no longer be used.

> [!WARNING] The controller will have to be restarted manually (e.g. by unplugging and plugging it back in) before it can be used again!.

<details>
<summary>Mqtt usage</summary>

Topic: `zwave/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/api/shutdownZwaveAPI/set`

Payload:

```json
{
	"args": []
}
```

</details>

#### `pollValue`

```ts
pollValue(valueId: ZUIValueId): Promise<unknown>;
```

Request an update of this value.

<details>
<summary>Mqtt usage</summary>

Topic: `zwave/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/api/pollValue/set`

Payload:

```json
{
	"args": [
		valueId
	]
}
```

</details>

#### `replaceFailedNode`

```ts
async replaceFailedNode(
	nodeId: number,
	strategy: InclusionStrategy = InclusionStrategy.Security_S2,
	options?: {
		qrString?: string
		provisioning?: PlannedProvisioningEntry
	},
): Promise<boolean>;
```

Replace failed node.

<details>
<summary>Mqtt usage</summary>

Topic: `zwave/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/api/replaceFailedNode/set`

Payload:

```json
{
	"args": [
		nodeId,
		strategy,
		options
	]
}
```

</details>

#### `getAvailableFirmwareUpdates`

```ts
async getAvailableFirmwareUpdates(
	nodeId: number,
	options?: GetFirmwareUpdatesOptions,
): Promise<{ version: string; changelog: string; channel: "stable" | "beta"; files: FirmwareUpdateFileInfo[]; downgrade: boolean; normalizedVersion: string; device: { manufacturerId: number; productType: number; productId: number; firmwareVersion: string; rfRegion?: RFRegion; }; }[]>;
```

<details>
<summary>Mqtt usage</summary>

Topic: `zwave/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/api/getAvailableFirmwareUpdates/set`

Payload:

```json
{
	"args": [
		nodeId,
		options
	]
}
```

</details>

#### `firmwareUpdateOTA`

```ts
async firmwareUpdateOTA(nodeId: number, updateInfo: FirmwareUpdateInfo): Promise<FirmwareUpdateResult>;
```

<details>
<summary>Mqtt usage</summary>

Topic: `zwave/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/api/firmwareUpdateOTA/set`

Payload:

```json
{
	"args": [
		nodeId,
		updateInfo
	]
}
```

</details>

#### `setPowerlevel`

```ts
async setPowerlevel(
	powerlevel: number,
	measured0dBm: number,
): Promise<boolean>;
```

<details>
<summary>Mqtt usage</summary>

Topic: `zwave/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/api/setPowerlevel/set`

Payload:

```json
{
	"args": [
		powerlevel,
		measured0dBm
	]
}
```

</details>

#### `setRFRegion`

```ts
async setRFRegion(region: RFRegion): Promise<boolean>;
```

<details>
<summary>Mqtt usage</summary>

Topic: `zwave/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/api/setRFRegion/set`

Payload:

```json
{
	"args": [
		region
	]
}
```

</details>

#### `startInclusion`

```ts
async startInclusion(
	strategy: InclusionStrategy = InclusionStrategy.Default,
	options?: {
		forceSecurity?: boolean
		provisioning?: PlannedProvisioningEntry
		qrString?: string
		name?: string
		dsk?: string
		location?: string
	},
): Promise<boolean>;
```

Start inclusion.

<details>
<summary>Mqtt usage</summary>

Topic: `zwave/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/api/startInclusion/set`

Payload:

```json
{
	"args": [
		strategy,
		options
	]
}
```

</details>

#### `startExclusion`

```ts
async startExclusion(
	options: ExclusionOptions = {
		strategy: ExclusionStrategy.DisableProvisioningEntry,
	},
): Promise<boolean>;
```

Start exclusion.

<details>
<summary>Mqtt usage</summary>

Topic: `zwave/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/api/startExclusion/set`

Payload:

```json
{
	"args": [
		options
	]
}
```

</details>

#### `stopExclusion`

```ts
stopExclusion(): Promise<boolean>;
```

Stop exclusion.

<details>
<summary>Mqtt usage</summary>

Topic: `zwave/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/api/stopExclusion/set`

Payload:

```json
{
	"args": []
}
```

</details>

#### `stopInclusion`

```ts
stopInclusion(): Promise<boolean>;
```

Stops inclusion.

<details>
<summary>Mqtt usage</summary>

Topic: `zwave/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/api/stopInclusion/set`

Payload:

```json
{
	"args": []
}
```

</details>

#### `rebuildNodeRoutes`

```ts
async rebuildNodeRoutes(nodeId: number): Promise<boolean>;
```

Rebuild node routes.

<details>
<summary>Mqtt usage</summary>

Topic: `zwave/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/api/rebuildNodeRoutes/set`

Payload:

```json
{
	"args": [
		nodeId
	]
}
```

</details>

#### `getPriorityReturnRoute`

```ts
getPriorityReturnRoute(nodeId: number, destinationId: number): Route;
```

Get priority return route from nodeId to destinationId.

<details>
<summary>Mqtt usage</summary>

Topic: `zwave/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/api/getPriorityReturnRoute/set`

Payload:

```json
{
	"args": [
		nodeId,
		destinationId
	]
}
```

</details>

#### `assignPriorityReturnRoute`

```ts
async assignPriorityReturnRoute(
	nodeId: number,
	destinationNodeId: number,
	repeaters: number[],
	routeSpeed: ZWaveDataRate,
): Promise<boolean>;
```

Assigns a priority return route from nodeId to destinationId.

<details>
<summary>Mqtt usage</summary>

Topic: `zwave/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/api/assignPriorityReturnRoute/set`

Payload:

```json
{
	"args": [
		nodeId,
		destinationNodeId,
		repeaters,
		routeSpeed
	]
}
```

</details>

#### `getPrioritySUCReturnRoute`

```ts
getPrioritySUCReturnRoute(nodeId: number): Route;
```

Get priority return route from node to controller.

<details>
<summary>Mqtt usage</summary>

Topic: `zwave/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/api/getPrioritySUCReturnRoute/set`

Payload:

```json
{
	"args": [
		nodeId
	]
}
```

</details>

#### `assignPrioritySUCReturnRoute`

```ts
async assignPrioritySUCReturnRoute(
	nodeId: number,
	repeaters: number[],
	routeSpeed: ZWaveDataRate,
): Promise<boolean>;
```

Assign a priority return route from node to controller.

<details>
<summary>Mqtt usage</summary>

Topic: `zwave/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/api/assignPrioritySUCReturnRoute/set`

Payload:

```json
{
	"args": [
		nodeId,
		repeaters,
		routeSpeed
	]
}
```

</details>

#### `getCustomReturnRoute`

```ts
getCustomReturnRoute(nodeId: number, destinationId: number): Route[];
```

Get custom return routes from nodeId to destinationId.

<details>
<summary>Mqtt usage</summary>

Topic: `zwave/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/api/getCustomReturnRoute/set`

Payload:

```json
{
	"args": [
		nodeId,
		destinationId
	]
}
```

</details>

#### `assignCustomReturnRoutes`

```ts
async assignCustomReturnRoutes(
	nodeId: number,
	destinationNodeId: number,
	routes: Route[],
	priorityRoute?: Route,
): Promise<boolean>;
```

Assigns custom return routes from a node to a destination node.

<details>
<summary>Mqtt usage</summary>

Topic: `zwave/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/api/assignCustomReturnRoutes/set`

Payload:

```json
{
	"args": [
		nodeId,
		destinationNodeId,
		routes,
		priorityRoute
	]
}
```

</details>

#### `getCustomSUCReturnRoute`

```ts
getCustomSUCReturnRoute(nodeId: number): Route[];
```

Get custom return routes from node to controller.

<details>
<summary>Mqtt usage</summary>

Topic: `zwave/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/api/getCustomSUCReturnRoute/set`

Payload:

```json
{
	"args": [
		nodeId
	]
}
```

</details>

#### `assignCustomSUCReturnRoutes`

```ts
async assignCustomSUCReturnRoutes(
	nodeId: number,
	routes: Route[],
	priorityRoute?: Route,
): Promise<boolean>;
```

Assigns up to 4 return routes to a node to the controller.

<details>
<summary>Mqtt usage</summary>

Topic: `zwave/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/api/assignCustomSUCReturnRoutes/set`

Payload:

```json
{
	"args": [
		nodeId,
		routes,
		priorityRoute
	]
}
```

</details>

#### `getPriorityRoute`

```ts
async getPriorityRoute(nodeId: number): Promise<{ routeKind: RouteKind.LWR | RouteKind.NLWR | RouteKind.Application; repeaters: number[]; routeSpeed: ZWaveDataRate; }>;
```

Returns the priority route for a given node ID.

<details>
<summary>Mqtt usage</summary>

Topic: `zwave/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/api/getPriorityRoute/set`

Payload:

```json
{
	"args": [
		nodeId
	]
}
```

</details>

#### `deleteReturnRoutes`

```ts
async deleteReturnRoutes(nodeId: number): Promise<boolean>;
```

Delete ALL previously assigned return routes.

<details>
<summary>Mqtt usage</summary>

Topic: `zwave/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/api/deleteReturnRoutes/set`

Payload:

```json
{
	"args": [
		nodeId
	]
}
```

</details>

#### `deleteSUCReturnRoutes`

```ts
async deleteSUCReturnRoutes(nodeId: number): Promise<boolean>;
```

Delete ALL previously assigned return routes to the controller.

<details>
<summary>Mqtt usage</summary>

Topic: `zwave/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/api/deleteSUCReturnRoutes/set`

Payload:

```json
{
	"args": [
		nodeId
	]
}
```

</details>

#### `assignReturnRoutes`

```ts
async assignReturnRoutes(nodeId: number, destinationNodeId: number): Promise<boolean>;
```

Ask the controller to automatically assign to node nodeId a set of routes to node destinationNodeId.

<details>
<summary>Mqtt usage</summary>

Topic: `zwave/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/api/assignReturnRoutes/set`

Payload:

```json
{
	"args": [
		nodeId,
		destinationNodeId
	]
}
```

</details>

#### `setPriorityRoute`

```ts
async setPriorityRoute(
	nodeId: number,
	repeaters: number[],
	routeSpeed: ZWaveDataRate,
): Promise<boolean>;
```

Sets the priority route for a given node ID.

<details>
<summary>Mqtt usage</summary>

Topic: `zwave/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/api/setPriorityRoute/set`

Payload:

```json
{
	"args": [
		nodeId,
		repeaters,
		routeSpeed
	]
}
```

</details>

#### `removePriorityRoute`

```ts
async removePriorityRoute(nodeId: number): Promise<boolean>;
```

Remove priority route for a given node ID.

<details>
<summary>Mqtt usage</summary>

Topic: `zwave/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/api/removePriorityRoute/set`

Payload:

```json
{
	"args": [
		nodeId
	]
}
```

</details>

#### `checkLifelineHealth`

```ts
async checkLifelineHealth(
	nodeId: number,
	rounds = 5,
): Promise<LifelineHealthCheckSummary & { targetNodeId: number }>;
```

Check node lifeline health.

<details>
<summary>Mqtt usage</summary>

Topic: `zwave/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/api/checkLifelineHealth/set`

Payload:

```json
{
	"args": [
		nodeId,
		rounds
	]
}
```

</details>

#### `checkRouteHealth`

```ts
async checkRouteHealth(
	nodeId: number,
	targetNodeId: number,
	rounds = 5,
): Promise<RouteHealthCheckSummary & { targetNodeId: number }>;
```

Check node routes health.

<details>
<summary>Mqtt usage</summary>

Topic: `zwave/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/api/checkRouteHealth/set`

Payload:

```json
{
	"args": [
		nodeId,
		targetNodeId,
		rounds
	]
}
```

</details>

#### `abortHealthCheck`

```ts
abortHealthCheck(nodeId: number): void;
```

Aborts an ongoing health check if one is currently in progress.

<details>
<summary>Mqtt usage</summary>

Topic: `zwave/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/api/abortHealthCheck/set`

Payload:

```json
{
	"args": [
		nodeId
	]
}
```

</details>

#### `isFailedNode`

```ts
async isFailedNode(nodeId: number): Promise<boolean>;
```

Check if a node is failed.

<details>
<summary>Mqtt usage</summary>

Topic: `zwave/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/api/isFailedNode/set`

Payload:

```json
{
	"args": [
		nodeId
	]
}
```

</details>

#### `removeFailedNode`

```ts
async removeFailedNode(nodeId: number): Promise<void>;
```

Remove a failed node.

<details>
<summary>Mqtt usage</summary>

Topic: `zwave/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/api/removeFailedNode/set`

Payload:

```json
{
	"args": [
		nodeId
	]
}
```

</details>

#### `refreshInfo`

```ts
refreshInfo(nodeId: number, options?: RefreshInfoOptions): Promise<void>;
```

Re interview the node.

<details>
<summary>Mqtt usage</summary>

Topic: `zwave/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/api/refreshInfo/set`

Payload:

```json
{
	"args": [
		nodeId,
		options
	]
}
```

</details>

#### `firmwareUpdateOTW`

```ts
async firmwareUpdateOTW(
	file: FwFile,
): Promise<ControllerFirmwareUpdateResult>;
```

Used to trigger an update of controller FW.

<details>
<summary>Mqtt usage</summary>

Topic: `zwave/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/api/firmwareUpdateOTW/set`

Payload:

```json
{
	"args": [
		file
	]
}
```

</details>

#### `updateFirmware`

```ts
updateFirmware(
	nodeId: number,
	files: FwFile[],
): Promise<FirmwareUpdateResult>;
```

<details>
<summary>Mqtt usage</summary>

Topic: `zwave/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/api/updateFirmware/set`

Payload:

```json
{
	"args": [
		nodeId,
		files
	]
}
```

</details>

#### `abortFirmwareUpdate`

```ts
async abortFirmwareUpdate(nodeId: number): Promise<void>;
```

<details>
<summary>Mqtt usage</summary>

Topic: `zwave/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/api/abortFirmwareUpdate/set`

Payload:

```json
{
	"args": [
		nodeId
	]
}
```

</details>

#### `dumpNode`

```ts
dumpNode(nodeId: number): import("/home/daniel/GitProjects/zwave-js-ui/node_modules/zwave-js/build/lib/node/Dump").NodeDump;
```

<details>
<summary>Mqtt usage</summary>

Topic: `zwave/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/api/dumpNode/set`

Payload:

```json
{
	"args": [
		nodeId
	]
}
```

</details>

#### `beginRebuildingRoutes`

```ts
beginRebuildingRoutes(options?: RebuildRoutesOptions): boolean;
```

<details>
<summary>Mqtt usage</summary>

Topic: `zwave/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/api/beginRebuildingRoutes/set`

Payload:

```json
{
	"args": [
		options
	]
}
```

</details>

#### `stopRebuildingRoutes`

```ts
stopRebuildingRoutes(): boolean;
```

<details>
<summary>Mqtt usage</summary>

Topic: `zwave/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/api/stopRebuildingRoutes/set`

Payload:

```json
{
	"args": []
}
```

</details>

#### `hardReset`

```ts
async hardReset(): Promise<void>;
```

<details>
<summary>Mqtt usage</summary>

Topic: `zwave/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/api/hardReset/set`

Payload:

```json
{
	"args": []
}
```

</details>

#### `softReset`

```ts
softReset(): Promise<void>;
```

<details>
<summary>Mqtt usage</summary>

Topic: `zwave/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/api/softReset/set`

Payload:

```json
{
	"args": []
}
```

</details>

#### `sendCommand`

```ts
async sendCommand(
	ctx: {
		nodeId: number
		endpoint: number
		commandClass: CommandClasses | keyof typeof CommandClasses
	},
	command: string,
	args: any[],
): Promise<any>;
```

Send a custom CC command. Check available commands by selecting a CC [here](https://zwave-js.github.io/node-zwave-js/#/api/CCs/index).

<details>
<summary>Mqtt usage</summary>

Topic: `zwave/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/api/sendCommand/set`

Payload:

```json
{
	"args": [
		ctx,
		command,
		args
	]
}
```

</details>

#### `writeBroadcast`

```ts
async writeBroadcast(
	valueId: ValueID,
	value: unknown,
	options?: SetValueAPIOptions,
): Promise<void>;
```

Send broadcast write request.

<details>
<summary>Mqtt usage</summary>

Topic: `zwave/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/api/writeBroadcast/set`

Payload:

```json
{
	"args": [
		valueId,
		value,
		options
	]
}
```

</details>

#### `writeMulticast`

```ts
async writeMulticast(
	nodes: number[],
	valueId: ZUIValueId,
	value: unknown,
	options?: SetValueAPIOptions,
): Promise<void>;
```

Send multicast write request to a group of nodes.

<details>
<summary>Mqtt usage</summary>

Topic: `zwave/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/api/writeMulticast/set`

Payload:

```json
{
	"args": [
		nodes,
		valueId,
		value,
		options
	]
}
```

</details>

#### `writeValue`

```ts
async writeValue(
	valueId: ZUIValueId,
	value: any,
	options?: SetValueAPIOptions,
): Promise<SetValueResult>;
```

Set a value of a specific zwave valueId.

<details>
<summary>Mqtt usage</summary>

Topic: `zwave/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/api/writeValue/set`

Payload:

```json
{
	"args": [
		valueId,
		value,
		options
	]
}
```

</details>

#### `grantSecurityClasses`

```ts
grantSecurityClasses(requested: InclusionGrant): void;
```

<details>
<summary>Mqtt usage</summary>

Topic: `zwave/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/api/grantSecurityClasses/set`

Payload:

```json
{
	"args": [
		requested
	]
}
```

</details>

#### `validateDSK`

```ts
validateDSK(dsk: string): void;
```

<details>
<summary>Mqtt usage</summary>

Topic: `zwave/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/api/validateDSK/set`

Payload:

```json
{
	"args": [
		dsk
	]
}
```

</details>

#### `abortInclusion`

```ts
abortInclusion(): void;
```

<details>
<summary>Mqtt usage</summary>

Topic: `zwave/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/api/abortInclusion/set`

Payload:

```json
{
	"args": []
}
```

</details>

#### `backupNVMRaw`

```ts
async backupNVMRaw(): Promise<{ data: Buffer; fileName: string; }>;
```

<details>
<summary>Mqtt usage</summary>

Topic: `zwave/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/api/backupNVMRaw/set`

Payload:

```json
{
	"args": []
}
```

</details>

#### `restoreNVM`

```ts
async restoreNVM(data: Buffer, useRaw = false): Promise<void>;
```

<details>
<summary>Mqtt usage</summary>

Topic: `zwave/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/api/restoreNVM/set`

Payload:

```json
{
	"args": [
		data,
		useRaw
	]
}
```

</details>

#### `getProvisioningEntries`

```ts
async getProvisioningEntries(): Promise<SmartStartProvisioningEntry[]>;
```

<details>
<summary>Mqtt usage</summary>

Topic: `zwave/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/api/getProvisioningEntries/set`

Payload:

```json
{
	"args": []
}
```

</details>

#### `getProvisioningEntry`

```ts
getProvisioningEntry(dsk: string): SmartStartProvisioningEntry | undefined;
```

<details>
<summary>Mqtt usage</summary>

Topic: `zwave/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/api/getProvisioningEntry/set`

Payload:

```json
{
	"args": [
		dsk
	]
}
```

</details>

#### `unprovisionSmartStartNode`

```ts
unprovisionSmartStartNode(dskOrNodeId: string | number): void;
```

<details>
<summary>Mqtt usage</summary>

Topic: `zwave/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/api/unprovisionSmartStartNode/set`

Payload:

```json
{
	"args": [
		dskOrNodeId
	]
}
```

</details>

#### `parseQRCodeString`

```ts
parseQRCodeString(qrString: string): {
	parsed?: QRProvisioningInformation
	nodeId?: number
	exists: boolean
};
```

<details>
<summary>Mqtt usage</summary>

Topic: `zwave/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/api/parseQRCodeString/set`

Payload:

```json
{
	"args": [
		qrString
	]
}
```

</details>

#### `provisionSmartStartNode`

```ts
provisionSmartStartNode(entry: PlannedProvisioningEntry | string): PlannedProvisioningEntry;
```

<details>
<summary>Mqtt usage</summary>

Topic: `zwave/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/api/provisionSmartStartNode/set`

Payload:

```json
{
	"args": [
		entry
	]
}
```

</details>

#### `updateControllerNodeProps`

```ts
async updateControllerNodeProps(
	node?: ZUINode,
	props: Array<'powerlevel' | 'RFRegion'> = ['powerlevel', 'RFRegion'],
): Promise<void>;
```

<details>
<summary>Mqtt usage</summary>

Topic: `zwave/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/api/updateControllerNodeProps/set`

Payload:

```json
{
	"args": [
		node,
		props
	]
}
```

</details>
<!-- AUTO GENERATED END -->

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

Topic: `zwave/office/light/38/0/targetValue/set`

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

### Node Last Active

`<mqtt_prefix>/<?node_location>/<node_name>/lastActive`

The payload will be the timestamp of last time a packet is received by controller from this node.

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
