# Home Assistant Using MQTT Discovery

The preferred method of integrating your Z-Wave components with Home Assistant is through the official Home Assistant [Z-Wave JS integration](https://www.home-assistant.io/integrations/zwave_js), this because MQTT Discovery is limited compared to a native integration and Home Assistant updates frequently break it. Based on this I would **NOT RECOMMEND** using MQTT Discovery, I don't plan to keep it maintained in the future.

If you elect to use MQTT discovery, the following settings will allow Z-Wave JS UI to automatically add devices to Home Assistant. In addition to Z-Wave JS UI, you must run an MQTT broker to act as the server.

To enable this method, you must set the flag **MQTT Discovery** in the Home Assistant tab.

> [!WARNING]
> At least Home Assistant >= 0.84 is required!
>
> When using MQTT discovery, Home Assistant updates often break Z-Wave JS UI device discovery. Z-Wave JS UI will always try to be compatible with the latest Home Assistant version. Check the changelog before updating!

Configuration steps:

- In your **Z-Wave JS UI** settings, [Home Assistant](/usage/setup?id=home-assistant) section, enable the `MQTT discovery` flag and enable the **retain** flag in the [MQTT](/usage/setup?id=mqtt) section. That flag is suggested to ensure that, once discovered, each device has the last published value available on startup (otherwise you have to wait for a value change).

> [!NOTE]
> Beginning with version `4.0.0`, the default birth/will topic is `homeassistant/status` in order to reflect the default birth/will of Home Assistant, which changed in version `0.113`.

- In your **Home Assistant** `configuration.yaml`:

```yaml
mqtt:
  discovery: true
  discovery_prefix: <your_discovery_prefix>
  broker: [YOUR MQTT BROKER] # Remove if you want to use builtin-in MQTT broker
  birth_message:
    topic: 'homeassistant/status'
    payload: 'online'
  will_message:
    topic: 'homeassistant/status'
    payload: 'offline'
```

If you want to use the embedded broker in Home Assistant you must [follow this guide](https://www.home-assistant.io/docs/mqtt/broker#embedded-broker).

Z-Wave JS UI is expecting Home Assistant to send its birth/will messages to `homeassistant/status`. Be sure to add this to your `configuration.yaml` if you want
Z-Wave JS UI to resend the cached values when Home Assistant restarts.

Z-Wave JS UI will try to guess how to map devices from Z-Wave to Home Assistant. At the moment, it tries to generate entities based on zwave values command classes, index, and units of the value. If the discovered device doesn't fit your needs, you can set a custom `device_class` using the Gateway value table.

## Components management

To see the components that have been discovered by Z-Wave JS UI, go to Control Panel UI, select a node from the nodes table, then select the Node tab from tabs menu at the bottom of nodes table. At the bottom of the page, after the node values section, there will be a section called `Home Assistant - Devices`. There you will find a table with all of the devices created for the selected node.

![Home Assistant Devices](../_images/Home Assistant_devices.png)

**ATTENTION**
The devices will loose all of customizations after a restart **unless** you store the changes by pressing the `STORE` button at the top of Home Assistant devices table. That will cause the Home Assistant settings to be stored in the `nodes.json` file. That file can also be imported/exported easily from the Control Panel UI at the top of nodes table.

### Rediscover Node

If you update the node name/location, you must also rediscover the values of this node to ensure they have the correct topics. To do this, press `REDISCOVER NODE` at the top of the **Home Assistant - Devices** table (check previous picture)

### Edit existing component

If you select a device, its configuration will be displayed as a JSON object on the right side. You can edit it and send some actions:

- `Update`: Update in-memory Home Assistant device configuration
- `Rediscover`: Re-discover this device using the `discoveryTopic` and `discovery_payload` of the configuration
- `Delete`: Delete the device from Home Assistant entities of selected node

### Add new component

If no device is selected, you can manually insert a device JSON configuration. If the configuration is valid you can press the `Add` button to add it to devices. If the process completes successfully, the device will be added to the Home Assistant devices table and you can then select it from the table and press `Rediscover` to discover your custom device.

## Custom Components

At the moment, MQTT discovery creates components like `sensor`, `cover` `binary_sensor` and `switch`. For more complex components like `climate` and `fan`, you will need to create your own configuration.

Default components configurations are stored in the `hass/devices.js` file. In order to add your **custom components configurations** you have to create a file named `customDevices.js`  or `customDevices.json` in **store** folder, there is also a watcher on this files that will automatically pick up new configurations, the watcher is setup on application startup so the file must exists before starting the application or you should restart application after creating it the first time.

There, all components are stored that Z-Wave JS UI needs to create for each Z-Wave device type. The key is the Z-Wave **device id**(`<manufacturerid>-<productid>-<producttype>`). The value is an array with all Home Assistant components to be created for that Z-Wave device.

To get the **Device id** of a specific node, go to Control Panel, select a node in the table, and select the Node tab. It will then be displayed under the Node Actions dropdown menu.

> [!NOTE]
> ONCE YOU SUCCESSFULLY INTEGRATE NEW COMPONENTS, PLEASE SEND A PR!

### Thermostats

```js
{
  type: 'climate',
  object_id: 'thermostat',
  values: [
    '64-0-mode',
    '49-0-Air temperature',
    '67-0-setpoint-1',
    '67-0-setpoint-2'
  ],
  mode_map: { off: 0, heat: 1, cool: 2 },
  setpoint_topic: {
    1: '67-0-setpoint-1',
    2: '67-0-setpoint-2'
  },
  default_setpoint: '67-0-setpoint-1',
  discovery_payload: {
    min_temp: 15,
    max_temp: 30,
    modes: ['off', 'heat', 'cool'],
    mode_state_topic: '64-0-mode',
    mode_command_topic: true,
    current_temperature_topic: '49-0-Air temperature',
    current_temperature_template: '{{ value_json.value }}',
    temperature_state_template: '{{ value_json.value }}',
    temperature_command_topic: true
  }
}
```

- **type**: The Home Assistant [MQTT component](https://www.home-assistant.io/components/mqtt/) type
- **object_id**: The unique id of this object (must be unique for the device)
- **values**: Array of values used by this component
- **mode_map**: Key-Value object where keys are [MQTT Climate](https://www.home-assistant.io/components/climate.mqtt/) modes and values are the matching thermostat modes values
- **setpoint_topic**: Key-Value object where keys are the modes of the Z-Wave thermostat and values are the matching setpoint `value id` (use this if your thermostat has more than one setpoint)
- **default_setpoint**: The default thermostat setpoint.
- **discovery_payload**: The payload sent to Home Assistant to discover this device. Check [here](https://www.home-assistant.io/integrations/climate.mqtt/) for a list of all supported options
  - **min_temp/max_temp**: Min/Max temperature of the thermostat
  - **modes**: Array of Home Assistant Climate supported modes. Allowed values are `[“auto”, “off”, “cool”, “heat”, “dry”, “fan_only”]`
  - **mode_state_topic**: `value id` of mode value
  - **current_temperature_topic**: `value id` of current temperature value
  - **current_temperature_template/temperature_state_template**: Template used to fetch the value from the MQTT payload
  - **temperature_command_topic/mode_command_topic**: If true this values are subscribed to this topics to send commands from Home Assistant to change this values

Thermostats are the most complex components to create. In this device example, the setpoint topic changes based on the mode selected. Z-Wave JS UI handles the mode changes by updating the device discovery payload to match the correct setpoint based on the mode selected.

### Fans

```js
{
  type: 'fan',
  object_id: 'dimmer',
  values: ['38-0-currentValue', '38-0-targetValue'],
  discovery_payload: {
    command_topic: '38-0-targetValue',
    speed_command_topic: '38-0-targetValue',
    speed_state_topic: '38-0-currentValue',
    state_topic: '38-0-currentValue',
    speeds: ['off', 'low', 'medium', 'high'],
    payload_low_speed: 24,
    payload_medium_speed: 50,
    payload_high_speed: 99,
    payload_off: 0,
    payload_on: 255,
    state_value_template:
      '{% if (value_json.value | int) == 0 %} 0 {% else %} 255 {% endif %}',
    speed_value_template:
      '{% if (value_json.value | int) == 0 %} 0 {% elif (value_json.value | int) <= 32 %} 24 {% elif (value_json.value | int) <= 66 %} 50 {% elif (value_json.value | int) <= 99 %} 99 {% endif %}'
  }
}
```

- **type**: The Home Assistant [MQTT component](https://www.home-assistant.io/components/mqtt/) type
- **object_id**: The unique id of this object (must be unique for the device)
- **values**: Array of values used by this component
- **discovery_payload**: The payload sent to Home Assistant to discover this device. Check [here](https://www.home-assistant.io/integrations/fan.mqtt/) for a list of all supported options
  - **command_topic**: The topic to send commands
  - **state_topic**: The topic to receive state updates
  - **speed_command_topic**: The topic used to send speed commands
  - **state_value_template**: The template used to set the value ON/OFF based on the payload received
  - **speed_value_template**: The template to use to set the speed `["off", "low", "medium", "high"]` based on the payload received

### Thermostats with Fans

The main template is like the thermostat template. The things to add are:

```js
{
  type: 'climate',
  object_id: 'thermostat',
  values: [
    '49-0-Air temperature',
    '64-0-mode',
    '66-0-state', // <-- add fan values
    '67-0-setpoint-1',
    '67-0-setpoint-2',
    '68-0-mode' // <-- add fan values
  ],
  mode_map: {
    off: 0,
    heat: 1,
    cool: 2
  },
  fan_mode_map: { // <-- add fan mode_map
    auto: 0,
    on: 1
  },
  setpoint_topic: {
    Heat: '67-0-setpoint-1',
    Cool: '67-0-setpoint-2'
  },
  default_setpoint: '67-0-setpoint-1',
  discovery_payload: {
    min_temp: 50,
    max_temp: 85,
    modes: ['off', 'heat', 'cool'],
    fan_modes: ['auto', 'on'], // <-- add fan supported modes
    action_topic: '66-0-state',
    action_template: '{{ value_json.value | lower }}',
    current_temperature_topic: '49-0-Air temperature',
    current_temperature_template: '{{ value_json.value }}',
    fan_mode_state_topic: '68-0-mode', // <-- add fan state topic
    fan_mode_command_topic: true, // <-- add fan command topic
    mode_state_topic: '64-0-mode',
    mode_command_topic: true,
    temperature_state_template: '{{ value_json.value }}',
    temperature_command_topic: true
  }
}
```

## Manually create entities

If MQTT discovery, the Z-Wave JS server, and custom components aren't enough for your needs, you can manually create entities in Home Assistant.

Note the settings used here are for the Gateway section of the Settings page:

- **Type**: ValueID topics
- **Payload type**: Just Value
- **Use node name instead of numeric nodeIDs**: true
- **Ignore location**: true

### Motion Sensor

Motion from a multi sensor:

```yaml
binary_sensor:
  - platform: mqtt
    name: 'Hall Motion Sensor'
    state_topic: 'zwave/hall/48/0/Motion'
    payload_on: 'true'
    payload_off: 'false'
    availability_topic: 'zwave/hall_motion_sensor/status'
    payload_available: 'true'
    payload_not_available: 'false'
    qos: 0
    device_class: motion
```

### Light on/off

Wall switch as a light:

```yaml
light:
  - platform: mqtt
    name: 'Office Light'
    state_topic: 'zwave/office_light/37/0/currentValue'
    command_topic: 'zwave/office_light/37/0/targetValue/set'
    availability_topic: 'zwave/office_light/status'
    payload_available: 'true'
    payload_not_available: 'false'
    payload_on: 'true'
    payload_off: 'false'
    optimistic: false
    qos: 0
    retain: true
```

### Lock

Lock (BE469ZP and Kwikset914c)

```yaml
lock:
  - platform: mqtt
    name: outside_lock
    state_topic: 'zwave/outside_lock/98/0/boltStatus'
    command_topic: 'zwave/outside_lock/98/0/targetMode/set'
    availability_topic: 'zwave/outside_lock/status'
    payload_available: 'true'
    payload_not_available: 'false'
    payload_lock: '255'
    payload_unlock: '0'
    state_locked: '"locked"'
    state_unlocked: '"unlocked"'
    optimistic: false
    qos: 1
    retain: true
```

### Switch

Wall switch controlling a fan

```yaml
switch:
  - platform: mqtt
    name: 'Fan Switch'
    state_topic: 'zwave/bathroom_fan/37/0/currentValue'
    command_topic: 'zwave/bathroom_fan/37/0/targetValue/set'
    availability_topic: 'zwave/bathroom_fan/status'
    payload_available: 'true'
    payload_not_available: 'false'
    payload_on: 'true'
    payload_off: 'false'
    state_on: 'true'
    state_off: 'false'
    optimistic: false
    qos: 0
    retain: true
```

### Sensor

Temp from a multi-sensor device

```yaml
sensor:
  - platform: mqtt
    state_topic: 'zwave/kitchen_motion_sensor/49/0/Air_temperature'
    name: 'Temperature'
    unit_of_measurement: 'F'
```

### Execute scene

If you need to create a switch that triggers a scene activation (using MQTT APIs) you can use this example.

Add the following entry in the `configuration.yaml`. Replace `<mqtt_prefix>` and `<mqtt_name>` with your values, based on your mqtt settings and `<sceneId>` with the scene you want to activate

```yaml
switch:
  - platform: mqtt
    name: Doorbell Scene
    unique_id: zwavedoorbellscene
    command_topic: '<mqtt_prefix>/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/api/_activateScene/set'
    payload_on: '{ "args": [ <sceneId> ] }'
```

## Troubleshooting

### Removing or resetting Home Assistant entities

If needed, it is possible to remove and reset entities added to Home Assistant via MQTT discovery. These entries are pushed via MQTT with the `Retained` flag set, so even if an entity disappears from **Z-Wave JS UI**, it will remain in Home Assistant.

To remove an entity in Home Assistant, you must remove the retained message in the Home Assistant discovery topics, by default `homeassistant/..`.

This can be done with [MQTT Explorer](http://mqtt-explorer.com/) or CLI tools like [`mosquitto_pub`](https://mosquitto.org/man/mosquitto_pub-1.html).

Note that in order for a removed entity to appear again, it must be published by **Z-Wave JS UI** again. This happens automatically for new devices, if enabled. Alternatively, this can be done manually by selecting the node in **Z-Wave JS UI**, and then for each Home Assistant device clicking `Rediscover Node`.
