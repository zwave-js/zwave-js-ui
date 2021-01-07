# Setup

Firstly you need to open the browser at the link <http://localhost:8091> and edit the settings for Zwave, MQTT and the Gateway.

## Zwave

Zwave settings:

- **Serial port**: The serial port where your controller is connected
- **Network key** (Optional): Zwave network key if security is enabled. The correct format is like the OZW key but without `0x` `,` and spaces: OZW: `0x5C, 0x14, 0x89, 0x74, 0x67, 0xC4, 0x25, 0x98, 0x51, 0x8A, 0xF1, 0x55, 0xDE, 0x6C, 0xCE, 0xA8` Zwavejs: `5C14897467C42598518AF155DE6CCEA8`
- **Log level**: Set the zwave-js Library log level
- **Log to file**: Enable this to store zwave-js logs to a file
- **Commands timeout**: Seconds to wait before automatically stop inclusion/exclusion
- **Hidden settings**: advanced settings not visible to the user interface, you can edit these by setting in the settings.json
  - `zwave.plugin` defines a js script that will be included with the `this` context of the zwave client, for example you could set this to `hack` and include a `hack.js` in the root of the app with `module.exports = zw => {zw.client.on("scan complete", () => console.log("scan complete")}`
  - `zwave.options` overrides options passed to the zwave js Driver constructor [ZWaveOptions](https://zwave-js.github.io/node-zwave-js/#/api/driver?id=zwaveoptions)

## MQTT

Mqtt settings:

- **Name**: A unique name that identify the Gateway.
- **Host**: The url of the broker. Insert here the protocol if present, example: `tls://localhost`. Mqtt supports these protocols: `mqtt`, `mqtts`, `tcp`, `tls`, `ws` and `wss`
- **Port**: Broker port
- **Reconnect period**: Milliseconds between two reconnection tries
- **Prefix**: The prefix where all values are published
- **QoS**: Quality Of Service (check MQTT specs) of outgoing packets
- **Retain**: The retain flag of outgoing packets
- **Clean**: Sets the clean flag when connecting to the broker
- **Store**: Enable/Disable persistent storage of packets (QoS > 0). If disabled in memory storage will be used but all packets stored in memory are lost in case of shutdowns or unexpected errors.
- **Allow self signed certs**: When using encrypted protocols, set this to true to allow self signed certificates (**WARNING** this could expose you to man in the middle attacks)
- **Ca Cert and Key**: Certificate Authority, Client Key and Client Certificate files required for secured connections (if broker requires valid certificates, this fields can be leave empty otherwise)
- **Auth**: Enable this if broker requires auth. If so you need to enter also a valid **username** and **password**.

## Gateway

Gateway settings:

- **Gateway type**: This setting specify the logic used to publish Zwave Nodes Values in MQTT topics. At the moment there are 3 possible configuration, two are automatic (all values are published in a specific topic) and one needs to manually configure which values you want to publish to MQTT and what topic to use. For every gateway type you can set custom topic values, if gateway is not in 'configure manually' mode you can omit the topic of the values (the topic will depends on the gateway type) and use the table to set values you want to `poll` or if you want to scale them using `post operation`

  1. **ValueId Topics**: _Automatically configured_. The topic where zwave values are published will be:

     `<mqtt_prefix>/<?node_location>/<nodeId>/<commandClass>/<endpoint>/<property>/<propertyKey>`

     - `mqtt_prefix`: the prefix set in Mqtt Settings
     - `node_location`: location of the Zwave Node (optional, if not present will not be added to the topic)
     - `nodeId`: the unique numerical id of the node in Zwave network
     - `commandClass`: the command class number of the value
     - `endpoint`: the endpoint number (if the node has more then one endpoint)
     - `property`: the value [property](https://zwave-js.github.io/node-zwave-js/#/api/valueid)
     - `propertyKey`: the value [propertyKey](https://zwave-js.github.io/node-zwave-js/#/api/valueid)

  2. **Named Topics**: _Automatically configured_. The topic where zwave values are published will be:

     `<mqtt_prefix>/<?node_location>/<node_name>/<class_name>/<?endpoint>/<propertyName>/<propertyKey>`

     - `mqtt_prefix`: the prefix set in Mqtt Settings
     - `node_location`: location of the Zwave Node (optional, if not present will not be added to the topic)
     - `node_name`: name of the node, if not set will be `nodeID_<node_id>`
     - `class_name`: the valueId command class name corresponding to given command class number or `unknownClass_<class_id>` if the class name is not known
     - `?endpoint`: Used just with multi-instance devices. The main enpoint (0) will not have this part in the topic but other instances will have: `endpoint_<endpoint>`
     - `propertyName`: the value [propertyName](https://zwave-js.github.io/node-zwave-js/#/api/valueid)
     - `propertyKey`: the value [propertyKey](https://zwave-js.github.io/node-zwave-js/#/api/valueid)

  3. **Configured Manually**: _Needs configuration_. The topic where zwave values are published will be:

     `<mqtt_prefix>/<?node_location>/<node_name>/<value_topic>`

     - `mqtt_prefix`: the prefix set in Mqtt Settings
     - `node_location`: location of the Zwave Node (optional, if not present will not be added to the topic)
     - `node_name`: name of the node, if not set will be `nodeID_<node_id>`
     - `value_topic`: the topic you want to use for that value (taken from gateway values table).

- **Payload type**: The content of the payload when an update is published:

  - **JSON Time-Value**: The payload will be a JSON object like:

    ```json
    {
      "time": 1548683523859,
      "value": 10
    }
    ```

  - **Entire ValueId Object**
    The payload will contain all info of a value from Zwave network:

    ```js
    {
      id: "38-0-targetValue",
      nodeId: 8,
      commandClass: 38,
      commandClassName: "Multilevel Switch",
      endpoint: 0,
      property: "targetValue",
      propertyName: "targetValue",
      propertyKey: undefined,
      type: "number",
      readable: true,
      writeable: true,
      description: undefined,
      label: "Target value",
      default: undefined,
      genre: "user",
      min: 0,
      max: 99,
      step: undefined,
      unit: undefined,
      list: false,
      value: undefined,
      lastUpdate: 1604044669393,
    }
    ```

    Example of a valueId with `states`:

    ```js
    {
      id: "112-0-200",
      nodeId: 8,
      commandClass: 112,
      commandClassName: "Configuration",
      endpoint: 0,
      property: 200,
      propertyName: "Partner ID",
      propertyKey: undefined,
      type: "number",
      readable: true,
      writeable: true,
      description: undefined,
      label: "Partner ID",
      default: 0,
      genre: "config",
      min: 0,
      max: 1,
      step: undefined,
      unit: undefined,
      list: true,
      states: [
        {
          text: "Aeon Labs Standard Product",
          value: 0,
        },
        {
          text: "others",
          value: 1,
        },
      ],
      value: 0,
      lastUpdate: 1604044675644,
    }
    ```

  - **Just value**: The payload will contain only the row Numeric/String/Bool value

- **Ignore status updates**: Enable this to prevent gateway to send an MQTT message when a node changes its status (dead/sleep == false, alive == true)
- **Ignore location**: Enable this to remove nodes location from topics
- **Send Zwave Events**: Enable this to send all Zwave client events to MQTT. More info [here](#zwave-events)
- **Include Node info**: Adds in ValueId json payload two extra values with the Name: `nodeName` and Location `nodeLocation` for better graphing capabilities (usefull in tools like InfluxDb,Grafana)
- **Publish node details**: Creates an `nodeinfo` topic under each node's MQTT tree, with most node details. Helps build up discovery payloads.
- **Use nodes name instead of numeric nodeIDs**: When gateway type is `ValueId` use this flag to force to use node names instead of node ids in topic.
- :star:**Hass discovery**:star:: Enable this to automatically create entities on Hass using MQTT autodiscovery (more about this [here](#robot-home-assistant-integration-beta))
- **Discovery Prefix**: The prefix to use to send MQTT discovery messages to HASS
- **Entity name template**: Custom Entity name based on placeholders. Default is `%loc-%n_%o`
  - `%n`: Node Name
  - `%loc`: Node Location
  - `%pk`: valueId property key (fallback to device type)
  - `%pn`: valueId property name (fallback to device type)
  - `%o`: HASS object_id
  - `%l`: valueId label (fallback to object_id)

Once finished press `SAVE` and gateway will start Zwave Network Scan, than go to 'Control Panel' section and wait until the scan is completed to check discovered devices and manage them.

Settings, scenes and Zwave configuration are stored in `JSON` files under project `store` folder that you can easily **import/export** for backup purposes.

### Gateway values table

The Gateway values table can be used with all gateway types to customize specific values topic for each device type found in the network and do some operations with them. Each value has this properties:

- **Device**: The device type. Once scan is complete, the gateway creates an array with all devices types found in the network. A device has a `device_id` that is unique, it is composed by this node properties: `<manufacturerid>-<productid>-<producttype>`.
- **Value**: The value you want to customize
- **Device Class**: If the value is a multilevel sensor, a binary sensor or a meter you can set a custom `device_class` to use with home assistant discovery. Check [sensor](https://www.home-assistant.io/components/sensor/#device-class) and [binary sensor](https://www.home-assistant.io/components/binary_sensor/#device-class)
- **Topic**: The topic to use for this value. It is the topic added after topic prefix, node name and location. If gateway type is different than `Manual` this can be leave blank and the value topic will be the one based on the gateway configuration chosen
- **Post operation**: If you want to convert your value (eg. '/10' '/100' '*10' '*100')
- **Parse Send**: Enable this to allow users to specify a custom `function(value)` to parse the value sent to MQTT. The function must be sync
- **Parse receive**: Enable this to allow users to specify a custom `function(value)` to parse the value received via MQTT. The function must be sync
