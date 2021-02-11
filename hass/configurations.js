// List of Home-Assistant configuration for MQTT Discovery
// https://www.home-assistant.io/docs/mqtt/discovery/

module.exports = {
  // Binary sensor https://www.home-assistant.io/components/binary_sensor.mqtt
  binary_sensor: {
    type: 'binary_sensor',
    object_id: 'event',
    discovery_payload: {
      payload_on: true,
      payload_off: false,
      value_template: '{{ value_json.value }}'
    }
  },

  // Sensor https://www.home-assistant.io/components/sensor.mqtt
  sensor_generic: {
    type: 'sensor',
    object_id: 'generic',
    discovery_payload: {
      value_template: '{{ value_json.value }}'
    }
  },
  central_scene: {
    type: 'sensor',
    object_id: 'scene_state',
    discovery_payload: {
      state_topic: true,
      value_template: '{{ value_json.value}}'
    }
  },
  // Light https://www.home-assistant.io/components/light.mqtt
  light_rgb_switch: {
    type: 'light',
    object_id: 'rgb_switch',
    discovery_payload: {
      state_topic: true,
      command_topic: true,
      rgb_command_template: "{{ '#%02x%02x%02x' | format(red, green, blue)}}",
      rgb_command_topic: true,
      rgb_state_topic: true,
      rgb_value_template:
        '{{ value_json.value[0:2] | int(0, 16) }},{{ value_json.value[2:4] | int(0, 16) }},{{ value_json.value[4:6] | int(0, 16) }}'
    }
  },
  light_rgb_dimmer: {
    type: 'light',
    object_id: 'rgb_dimmer',
    discovery_payload: {
      state_topic: true,
      command_topic: true,
      brightness_state_topic: true,
      brightness_command_topic: true,
      on_command_type: 'brightness',
      state_value_template: '{{ "OFF" if value_json.value == 0 else "ON" }}',
      brightness_value_template: '{{ value_json.value }}',
      brightness_scale: 99,
      rgb_command_template: '{{ "#%02x%02x%02x" | format(red, green, blue)}}',
      rgb_command_topic: true,
      rgb_state_topic: true,
      rgb_value_template:
        '{{ value_json.value[0:2] | int(0, 16) }},{{ value_json.value[2:4] | int(0, 16) }},{{ value_json.value[4:6] | int(0, 16) }}'
    }
  },
  light_dimmer: {
    type: 'light',
    object_id: 'dimmer',
    discovery_payload: {
      command_topic: true,
      state_topic: true,
      state_value_template: '{{ "OFF" if value_json.value == 0 else "ON" }}',
      brightness_command_topic: true,
      brightness_scale: 99,
      brightness_state_topic: true,
      brightness_value_template: '{{ value_json.value }}',
      on_command_type: 'brightness'
    }
  },
  volume_dimmer: {
    type: 'light',
    object_id: 'volume_dimmer',
    discovery_payload: {
      command_topic: true,
      state_topic: false,
      brightness_command_topic: true,
      brightness_scale: 100,
      brightness_state_topic: true,
      brightness_value_template: '{{ value_json.value }}',
      on_command_type: 'last',
      payload_off: 0,
      payload_on: 25
    }
  },

  // Switch https://www.home-assistant.io/components/switch.mqtt
  switch: {
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
  cover: {
    type: 'cover',
    object_id: 'cover',
    discovery_payload: {
      command_topic: true,
      optimistic: true
    }
  },
  cover_position: {
    type: 'cover',
    object_id: 'position',
    discovery_payload: {
      state_topic: true,
      command_topic: true,
      position_topic: true,
      set_position_topic: true,
      value_template: '{{ value_json.value | round(0) }}',
      position_open: 99,
      position_closed: 0,
      payload_open: '99',
      payload_close: '0'
    }
  },
  // Barrier operator support for zwave-js (numeric commands/states)
  barrier_state: {
    type: 'cover',
    object_id: 'barrier_state',
    discovery_payload: {
      command_topic: true,
      state_topic: true,
      value_template: '{{ value_json.value }}',
      device_class: 'garage',
      payload_open: 255,
      payload_close: 0,
      payload_stop: 253,
      state_open: 255,
      state_opening: 254,
      state_closed: 0,
      state_closing: 252
    }
  },

  // Lock https://www.home-assistant.io/components/lock.mqtt
  lock: {
    type: 'lock',
    object_id: 'lock',
    discovery_payload: {
      command_topic: true,
      state_locked: 255,
      state_unlocked: 0,
      payload_lock: 255,
      payload_unlock: 0,
      value_template: '{{ value_json.value }}'
    }
  },

  // Thermostat/HVAC https://www.home-assistant.io/components/climate.mqtt
  thermostat: {
    type: 'climate',
    object_id: 'climate',
    discovery_payload: {
      min_temp: 5,
      max_temp: 40,
      temp_step: 0.5,
      modes: [],
      mode_state_template: '{{ value_json.value }}',
      current_temperature_topic: true,
      current_temperature_template: '{{ value_json.value }}',
      temperature_state_topic: true,
      temperature_state_template: '{{ value_json.value }}',
      temperature_command_topic: true
    }
  },

  // Fan https://www.home-assistant.io/components/fan.mqtt/
  fan: {
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
  },
  sound_switch: {
    type: 'fan',
    object_id: 'sound_switch',
    discovery_payload: {
      command_topic: true,
      speed_command_topic: true,
      speed_state_topic: true,
      state_topic: true,
      speeds: ['off', 'low', 'medium', 'high'],
      payload_low_speed: 10,
      payload_medium_speed: 25,
      payload_high_speed: 50,
      payload_off: 0,
      payload_on: 25,
      state_value_template: '{{ value_json.value | int }}',
      speed_value_template: '{{ value_json.value | int }}'
    }
  }
}
