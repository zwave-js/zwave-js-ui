// List of Home-Assistant configuration for MQTT Discovery
// https://www.home-assistant.io/docs/mqtt/discovery/

module.exports = {
  // Binary sensor https://www.home-assistant.io/components/binary_sensor.mqtt
  'binary_sensor_occupancy': {
    type: 'binary_sensor',
    object_id: 'occupancy',
    discovery_payload: {
      payload_on: true,
      payload_off: false,
      value_template: '{{ value_json.value }}',
      device_class: 'motion'
    }
  },
  'binary_sensor_presence': {
    type: 'binary_sensor',
    object_id: 'presence',
    discovery_payload: {
      payload_on: true,
      payload_off: false,
      value_template: '{{ value_json.value }}',
      device_class: 'presence'
    }
  },
  'binary_sensor_contact': {
    type: 'binary_sensor',
    object_id: 'contact',
    discovery_payload: {
      payload_on: true,
      payload_off: false,
      value_template: '{{ value_json.value }}',
      device_class: 'door'
    }
  },
  'binary_sensor_lock': {
    type: 'binary_sensor',
    object_id: 'lock',
    discovery_payload: {
      payload_on: false,
      payload_off: true,
      value_template: '{{ value_json.value }}',
      device_class: 'lock'
    }
  },
  'binary_sensor_water_leak': {
    type: 'binary_sensor',
    object_id: 'water_leak',
    discovery_payload: {
      payload_on: true,
      payload_off: false,
      value_template: '{{ value_json.value }}',
      device_class: 'moisture'
    }
  },
  'binary_sensor_smoke': {
    type: 'binary_sensor',
    object_id: 'smoke',
    discovery_payload: {
      payload_on: true,
      payload_off: false,
      value_template: '{{ value_json.value }}',
      device_class: 'smoke'
    }
  },
  'binary_sensor_gas': {
    type: 'binary_sensor',
    object_id: 'gas',
    discovery_payload: {
      payload_on: true,
      payload_off: false,
      value_template: '{{ value_json.value }}',
      device_class: 'gas'
    }
  },
  'binary_sensor_carbon_monoxide': {
    type: 'binary_sensor',
    object_id: 'carbon_monoxide',
    discovery_payload: {
      payload_on: true,
      payload_off: false,
      value_template: '{{ value_json.value }}',
      device_class: 'safety'
    }
  },
  'binary_sensor_tamper': {
    type: 'binary_sensor',
    object_id: 'tamper',
    discovery_payload: {
      payload_on: true,
      payload_off: false,
      value_template: '{{ value_json.value }}',
      device_class: 'safety'
    }
  },
  'binary_sensor_alarm': {
    type: 'binary_sensor',
    object_id: 'alarm',
    discovery_payload: {
      payload_on: true,
      payload_off: false,
      value_template: '{{ value_json.value }}',
      device_class: 'problem'
    }
  },
  'binary_sensor_router': {
    type: 'binary_sensor',
    object_id: 'router',
    discovery_payload: {
      payload_on: true,
      payload_off: false,
      value_template: '{{ value_json.value }}',
      device_class: 'connectivity'
    }
  },
  'binary_sensor_battery_low': {
    type: 'binary_sensor',
    object_id: 'battery_low',
    discovery_payload: {
      payload_on: true,
      payload_off: false,
      value_template: '{{ value_json.value}}',
      device_class: 'battery'
    }
  },

  // Sensor https://www.home-assistant.io/components/sensor.mqtt
  'sensor_generic': {
    type: 'sensor',
    object_id: 'generic',
    discovery_payload: {
      value_template: '{{ value_json.value }}'
    }
  },
  'sensor_illuminance': {
    type: 'sensor',
    object_id: 'illuminance',
    discovery_payload: {
      unit_of_measurement: 'lx',
      device_class: 'illuminance',
      value_template: '{{ value_json.value }}'
    }
  },
  'sensor_humidity': {
    type: 'sensor',
    object_id: 'humidity',
    discovery_payload: {
      unit_of_measurement: '%',
      device_class: 'humidity',
      value_template: '{{ value_json.value }}'
    }
  },
  'sensor_temperature': {
    type: 'sensor',
    object_id: 'temperature',
    discovery_payload: {
      unit_of_measurement: '°C',
      device_class: 'temperature',
      value_template: '{{ value_json.value }}'
    }
  },
  'sensor_pressure': {
    type: 'sensor',
    object_id: 'pressure',
    discovery_payload: {
      unit_of_measurement: 'hPa',
      device_class: 'pressure',
      value_template: '{{ value_json.value }}'
    }
  },
  'sensor_click': {
    type: 'sensor',
    object_id: 'click',
    discovery_payload: {
      icon: 'mdi:toggle-switch',
      value_template: '{{ value_json.value }}'
    }
  },
  'sensor_power': {
    type: 'sensor',
    object_id: 'power',
    discovery_payload: {
      unit_of_measurement: 'Watt',
      icon: 'mdi:flash',
      value_template: '{{ value_json.value }}'
    }
  },
  'sensor_action': {
    type: 'sensor',
    object_id: 'action',
    discovery_payload: {
      icon: 'mdi:gesture-double-tap',
      value_template: '{{ value_json.value }}'
    }
  },
  'sensor_brightness': {
    type: 'sensor',
    object_id: 'brightness',
    discovery_payload: {
      unit_of_measurement: 'brightness',
      icon: 'mdi:brightness-5',
      value_template: '{{ value_json.value }}'
    }
  },
  'sensor_lock': {
    type: 'sensor',
    object_id: 'lock',
    discovery_payload: {
      icon: 'mdi:lock',
      value_template: '{{ value_json.value }}'
    }
  },
  'sensor_battery': {
    type: 'sensor',
    object_id: 'battery',
    discovery_payload: {
      unit_of_measurement: '%',
      device_class: 'battery',
      value_template: '{{ value_json.value }}'
    }
  },
  'sensor_linkquality': {
    type: 'sensor',
    object_id: 'linkquality',
    discovery_payload: {
      unit_of_measurement: '-',
      value_template: '{{ value_json.value }}'
    }
  },
  'sensor_gas_density': {
    type: 'sensor',
    object_id: 'gas_density',
    discovery_payload: {
      value_template: '{{ value_json.value }}',
      icon: 'mdi:google-circles-communities'
    }
  },
  'sensor_water': {
    type: 'sensor',
    object_id: 'water',
    discovery_payload: {
      value_template: '{{ value_json.value }}',
      icon: 'mdi:water'
    }
  },
  'sensor_pulse': {
    type: 'sensor',
    object_id: 'pulse',
    discovery_payload: {
      value_template: '{{ value_json.value }}',
      icon: 'mdi:pulse'
    }
  },
  'sensor_cover': {
    type: 'sensor',
    object_id: 'cover',
    discovery_payload: {
      value_template: '{{ value_json.value }}',
      icon: 'mdi:view-array'
    }
  },

  // Light https://www.home-assistant.io/components/light.mqtt
  'light_rgb': {
    type: 'light',
    object_id: 'rgb',
    discovery_payload: {
      rgb_command_template: '{{ \'#%02x%02x%02x00\' | format(blue, green, red)}}',
      rgb_command_topic: true,
      rgb_state_topic: true,
      rgb_value_template: '{{ value_json.value }}'
    }
  },
  'light_dimmer': {
    type: 'light',
    object_id: 'dimmer',
    discovery_payload: {
      schema: 'template',
      brightness_template: '{{ (value_json.value / 99 * 255) | round(0) }}',
      state_topic: true,
      state_template: '{{ "off" if value_json.value == 0 else "on" }}',
      command_topic: true,
      command_on_template: '{{ ((brightness / 255 * 99) | round(0)) if brightness is defined else 255 }}',
      command_off_template: '0'
    }
  },

  // Switch https://www.home-assistant.io/components/switch.mqtt
  'switch': {
    type: 'switch',
    object_id: 'switch',
    discovery_payload: {
      payload_off: false,
      payload_on: true,
      value_template: '{{ value_json.value }}',
      command_topic: true
    }
  },

  // Cover https://www.home-assistant.io/components/cover.mqtt
  'cover': {
    type: 'cover',
    object_id: 'cover',
    discovery_payload: {
      command_topic: true,
      optimistic: true
    }
  },
  'cover_position': {
    type: 'cover',
    object_id: 'cover',
    discovery_payload: {
      command_topic: true,
      position_topic: true,
      set_position_topic: true,
      set_position_template: '{ "value": {{ position }} }',
      value_template: '{{ value_json.value }}',
      state_topic: false
    }
  },

  // Lock https://www.home-assistant.io/components/lock.mqtt
  'lock': {
    type: 'lock',
    object_id: 'lock',
    discovery_payload: {
      command_topic: true,
      value_template: '{{ value_json.value }}'
    }
  },

  // Thermostat/HVAC https://www.home-assistant.io/components/climate.mqtt
  'thermostat': {
    type: 'climate',
    object_id: 'climate',
    discovery_payload: {
      min_temp: 7,
      max_temp: 30,
      modes: ['off', 'auto', 'heat'],
      mode_state_topic: true,
      mode_state_template: '{{ value_json.mode }}',
      mode_command_topic: true,
      current_temperature_topic: true,
      current_temperature_template: '{{ value_json.value }}',
      temperature_state_topic: true,
      temperature_state_template: '{{ value_json.value }}',
      temperature_command_topic: true
    }
  },

  // Fan https://www.home-assistant.io/components/fan.mqtt/
  'fan': {
    type: 'fan',
    object_id: 'fan',
    discovery_payload: {
      state_topic: true,
      state_value_template: '{{ value_json.state }}',
      command_topic: true,
      command_topic_postfix: 'fan_state',
      speed_state_topic: true,
      speed_command_topic: true,
      speed_value_template: '{{ value_json.speed }}',
      speeds: ['off', 'low', 'medium', 'high', 'on', 'auto', 'smart']
    }
  }
}
