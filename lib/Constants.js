module.exports = {
  // https://github.com/OpenZWave/open-zwave/blob/0d94c9427bbd19e47457578bccc60b16c6679b49/config/Localization.xml#L606
  _productionMap: {
    0: 'instant',
    1: 'total',
    2: 'today',
    3: 'time'
  },
  productionType (index) {
    return {
      sensor: 'energy_production',
      objectId: this._productionMap[index] || 'unknown',
      props: {
        device_class: index === 3 ? 'timestamp' : 'power'
      }
    }
  },
  // https://github.com/OpenZWave/open-zwave/blob/0d94c9427bbd19e47457578bccc60b16c6679b49/config/Localization.xml#L679
  // https://github.com/OpenZWave/open-zwave/blob/0d94c9427bbd19e47457578bccc60b16c6679b49/cpp/src/command_classes/Meter.cpp#L74
  _metersMap: {
    0: 'kwh', // electricity
    1: 'kvah',
    2: 'w',
    3: 'pulses',
    4: 'v',
    5: 'a',
    6: 'pf',
    8: 'kvar',
    9: 'kvarh',
    16: 'm3', // gas
    17: 'ft3',
    19: 'pulses',
    32: 'm3', // water
    33: 'ft3',
    34: 'gal',
    35: 'pulses',
    48: 'kwh', // heating (electricity)
    64: 'kwh' // cooling (electricity)
  },
  meterType (index) {
    let cfg = null
    if (index >= 16 && index < 32) {
      // gas
      cfg = this.sensorType(55)
    } else if (index >= 32 && index < 48) {
      // water
      cfg = this.sensorType(12)
    } else {
      // electricity
      cfg = this.sensorType(4)
    }

    cfg.objectId = (this._metersMap[index] || 'unknown') + '_meter'
    return cfg
  },
  // https://github.com/OpenZWave/open-zwave/blob/4478eea26b0e1a29184df0515a8034757258ff88/cpp/src/ValueIDIndexesDefines.def#L1068
  // https://github.com/OpenZWave/open-zwave/blob/05a096f75dddd27e3f8dc6af2afdb3cad3b4ebaa/config/Localization.xml#L7
  _alarmMap: {
    1: 'smoke',
    2: 'carbon_monoxide',
    3: 'carbon_dioxide',
    4: 'heat',
    5: 'water',
    6: 'access_control',
    7: 'home_security',
    8: 'power_management',
    9: 'system',
    10: 'emergency',
    11: 'clock',
    12: 'appliance',
    13: 'home_health',
    14: 'siren',
    15: 'water_valve',
    16: 'weather',
    17: 'irrigation',
    18: 'gas',
    256: 'previous_event_cleared',
    257: 'alert_location',
    512: 'type',
    513: 'level'
  },
  alarmType (index) {
    return this._alarmMap[index] || 'unknown_' + index
  },
  // https://github.com/OpenZWave/open-zwave/blob/0d94c9427bbd19e47457578bccc60b16c6679b49/config/SensorMultiLevelCCTypes.xml
  _sensorMap: {
    temperature: {
      1: 'air',
      11: 'dew_point',
      23: 'water',
      24: 'soil',
      34: 'target',
      62: 'boiler_water',
      63: 'domestic_hot_water',
      64: 'outside',
      65: 'exhaust',
      72: 'return_air',
      73: 'supply_air',
      74: 'condenser_coil',
      75: 'evaporator_coil',
      76: 'liquid_line',
      77: 'discharge_line',
      80: 'defrost',
      props: {
        device_class: 'temperature'
      }
    },
    illuminance: {
      3: '', // illuminance
      props: {
        device_class: 'illuminance'
      }
    },
    electricity: {
      4: 'power',
      15: 'voltage',
      16: 'current',
      28: 'resistivity',
      29: 'conductivity',
      props: {
        device_class: 'power'
      }
    },
    humidity: {
      5: 'air', // humidity
      41: 'soil',
      props: {
        device_class: 'humidity'
      }
    },
    speed: {
      6: 'velocity', // ?
      52: 'x_acceleration',
      53: 'y_acceleration',
      54: 'z_acceleration',
      props: {
        icon: 'mdi:speedometer'
      }
    },
    direction: {
      7: '', // direction
      21: 'angle_position', // ?
      props: {
        icon: 'mdi:compass'
      }
    },
    pressure: {
      8: 'atmospheric',
      9: 'barometric',
      57: 'water',
      props: {
        device_class: 'pressure'
      }
    },
    sun: {
      10: 'solar_radiation',
      27: 'ultraviolet',
      props: {
        icon: 'mdi:white-balance-sunny'
      }
    },
    water: {
      12: 'rain_rate',
      13: 'tide_level',
      19: 'tank_capacity',
      56: 'flow',
      props: {
        icon: 'mdi:water'
      }
    },
    weight: {
      14: '', // weight
      46: 'muscle_mass',
      47: 'bone_mass',
      48: 'fat_mass',
      49: 'total_body_water',
      51: 'body_mass_index',
      66: 'water_chlorine',
      67: 'water_acidity',
      68: 'water_oxidation_potential',
      props: {
        icon: 'mdi:weight'
      }
    },
    gas: {
      17: 'carbon_dioxide',
      40: 'carbon_monoxide',
      55: 'smoke_density',
      props: {
        icon: 'mdi:thought-bubble'
      }
    },
    air: {
      18: 'flow',
      props: {
        icon: 'mdi:air-filter'
      }
    },
    frequency: {
      22: 'rotation',
      32: '',
      props: {}
    },
    sound: {
      30: 'loudness',
      props: {
        icon: 'mdi:volume-high'
      }
    },
    signal: {
      58: 'strength',
      props: {
        device_class: 'signal_strength'
      }
    },
    timestamp: {
      33: '', // time,
      props: {
        device_class: 'timestamp'
      }
    },
    heart: {
      44: 'rate',
      45: 'blood_pressure',
      50: 'basic_metabolic_rate',
      60: 'respiratory_rate',
      69: 'lf_lh_ratio',
      props: {
        icon: 'mdi:heart'
      }
    },
    generic: {
      2: 'general_purpose',
      20: 'distance',
      25: 'seismic_intensity',
      26: 'seismic_magnitude',
      31: 'moisture',
      35: 'particulate_matter_25',
      36: 'formaldehyde',
      37: 'radon_concentration',
      38: 'methane_density',
      39: 'volatile_organic_compound',
      42: 'soil_reactivity',
      43: 'soil_salinity',
      59: 'particulate_matter',
      61: 'relative_modulation',
      70: 'motion_direction',
      71: 'applied_force',
      78: 'suction',
      79: 'discharge',
      81: 'ozone',
      82: 'sulfur_dioxide',
      83: 'nitrogen_dioxide',
      84: 'ammonia',
      85: 'lead',
      86: 'particulate_matter'
    }
  },
  sensorType (index) {
    const sensorType = {
      sensor: 'generic',
      objectId: 'unknown_' + index,
      props: {}
    }

    for (const sensor in this._sensorMap) {
      const objectId = this._sensorMap[sensor][index]
      if (objectId !== undefined) {
        sensorType.sensor = sensor
        sensorType.objectId = objectId
        sensorType.props = this._sensorMap[sensor].props || {}
        break
      }
    }

    return sensorType
  },
  _commandClassMap: {
    0x00: 'no_operation',
    0x20: 'basic',
    0x21: 'controller_replication',
    0x22: 'application_status',
    0x23: 'zip_services',
    0x24: 'zip_server',
    0x25: 'switch_binary',
    0x26: 'switch_multilevel',
    0x27: 'switch_all',
    0x28: 'switch_toggle_binary',
    0x29: 'switch_toggle_multilevel',
    0x2a: 'chimney_fan',
    0x2b: 'scene_activation',
    0x2c: 'scene_actuator_conf',
    0x2d: 'scene_controller_conf',
    0x2e: 'zip_client',
    0x2f: 'zip_adv_services',
    0x30: 'sensor_binary',
    0x31: 'sensor_multilevel',
    0x32: 'meter',
    0x33: 'color',
    0x34: 'zip_adv_client',
    0x35: 'meter_pulse',
    0x3c: 'meter_tbl_config',
    0x3d: 'meter_tbl_monitor',
    0x3e: 'meter_tbl_pulse',
    0x38: 'thermostat_heating',
    0x40: 'thermostat_mode',
    0x42: 'thermostat_operating_state',
    0x43: 'thermostat_setpoint',
    0x44: 'thermostat_fan_mode',
    0x45: 'thermostat_fan_state',
    0x46: 'climate_control_schedule',
    0x47: 'thermostat_setback',
    0x4c: 'door_lock_logging',
    0x4e: 'schedule_entry_lock',
    0x50: 'basic_window_covering',
    0x51: 'mtp_window_covering',
    0x56: 'crc16_encap',
    0x5a: 'device_reset_locally',
    0x5b: 'central_scene',
    0x5e: 'zwave_plus_info',
    0x5d: 'antitheft',
    0x60: 'multi_instance',
    0x62: 'door_lock',
    0x63: 'user_code',
    0x66: 'barrier_operator',
    0x70: 'configuration',
    0x71: 'alarm',
    0x72: 'manufacturer_specific',
    0x73: 'powerlevel',
    0x75: 'protection',
    0x76: 'lock',
    0x77: 'node_naming',
    0x79: 'sound_switch',
    0x7a: 'firmware_update_md',
    0x7b: 'grouping_name',
    0x7c: 'remote_association_activate',
    0x7d: 'remote_association',
    0x80: 'battery',
    0x81: 'clock',
    0x82: 'hail',
    0x84: 'wake_up',
    0x85: 'association',
    0x86: 'version',
    0x87: 'indicator',
    0x88: 'proprietary',
    0x89: 'language',
    0x8a: 'time',
    0x8b: 'time_parameters',
    0x8c: 'geographic_location',
    0x8d: 'composite',
    0x8e: 'multi_instance_association',
    0x8f: 'multi_cmd',
    0x90: 'energy_production',
    0x91: 'manufacturer_proprietary',
    0x92: 'screen_md',
    0x93: 'screen_attributes',
    0x94: 'simple_av_control',
    0x95: 'av_content_directory_md',
    0x96: 'av_renderer_status',
    0x97: 'av_content_search_md',
    0x98: 'security',
    0x99: 'av_tagging_md',
    0x9a: 'ip_configuration',
    0x9b: 'association_command_configuration',
    0x9c: 'sensor_alarm',
    0x9d: 'silence_alarm',
    0x9e: 'sensor_configuration',
    0xef: 'mark',
    0xf0: 'non_interoperable'
  },
  commandClass (cmd) {
    return this._commandClassMap[cmd] || 'unknownClass_' + cmd
  },
  _genericDeviceClassMap: {
    // https://github.com/OpenZWave/open-zwave/blob/master/config/device_classes.xml
    // https://github.com/home-assistant/core/blob/dev/homeassistant/components/zwave/const.py#L196
    // 0x00: specific_type_not_used // Available in all Generic types
    0x01: {
      generic: 'generic_type_generic_controller',
      specific: {
        0x01: 'specific_type_portable_controller',
        0x02: 'specific_type_portable_scene_controller',
        0x03: 'specific_type_portable_installer_tool',
        0x04: 'specific_type_control_av',
        0x06: 'specific_type_control_simple'
      }
    },
    0x02: {
      generic: 'generic_type_static_controller',
      specific: {
        0x01: 'specific_type_pc_controller',
        0x02: 'specific_type_scene_controller',
        0x03: 'specific_type_static_installer_tool',
        0x04: 'specific_type_set_top_box',
        0x05: 'specific_type_sub_system_controller',
        0x06: 'specific_type_tv',
        0x07: 'specific_type_gateway'
      }
    },
    0x03: {
      generic: 'generic_type_av_control_point',
      specific: {
        0x01: 'specific_type_sound_switch',
        0x04: 'specific_type_satellite_receiver',
        0x11: 'specific_type_satellite_receiver_v2',
        0x12: 'specific_type_doorbell'
      }
    },
    0x04: {
      generic: 'generic_type_display',
      specific: {
        0x01: 'specific_type_simple_display'
      }
    },
    0x05: {
      generic: 'generic_type_network_extender',
      specific: {
        0x01: 'specific_type_secure_extender'
      }
    },
    0x06: {
      generic: 'generic_type_appliance',
      specific: {
        0x01: 'specific_type_general_appliance',
        0x02: 'specific_type_kitchen_appliance',
        0x03: 'specific_type_laundry_appliance'
      }
    },
    0x07: {
      generic: 'generic_type_sensor_notification',
      specific: {
        0x01: 'specific_type_notification_sensor'
      }
    },
    0x08: {
      generic: 'generic_type_thermostat',
      specific: {
        0x01: 'specific_type_thermostat_heating',
        0x02: 'specific_type_thermostat_general',
        0x03: 'specific_type_setback_schedule_thermostat',
        0x04: 'specific_type_setpoint_thermostat',
        0x05: 'specific_type_setback_thermostat',
        0x06: 'specific_type_thermostat_general_v2'
      }
    },
    0x09: {
      generic: 'generic_type_windows_covering',
      specific: {
        0x01: 'specific_type_simple_window_covering'
      }
    },
    0x0f: {
      generic: 'generic_type_repeater_slave',
      specific: {
        0x01: 'specific_type_repeater_slave',
        0x02: 'specific_type_virtual_node'
      }
    },
    0x10: {
      generic: 'generic_type_switch_binary',
      specific: {
        0x01: 'specific_type_power_switch_binary',
        0x02: 'specific_type_color_tunable_binary',
        0x03: 'specific_type_scene_switch_binary',
        0x04: 'specific_type_power_strip',
        0x05: 'specific_type_siren',
        0x06: 'specific_type_valve_open_close',
        0x07: 'specific_type_irrigation_controller'
      }
    },
    0x11: {
      generic: 'generic_type_switch_multilevel',
      specific: {
        0x01: 'specific_type_power_switch_multilevel',
        0x02: 'specific_type_color_tunable_multilevel',
        0x03: 'specific_type_motor_multiposition',
        0x04: 'specific_type_scene_switch_multilevel',
        0x05: 'specific_type_class_a_motor_control',
        0x06: 'specific_type_class_b_motor_control',
        0x07: 'specific_type_class_c_motor_control',
        0x08: 'specific_type_fan_switch'
      }
    },
    0x12: {
      generic: 'generic_type_switch_remote',
      specific: {
        0x01: 'specific_type_remote_binary',
        0x02: 'specific_type_remote_multilevel',
        0x03: 'specific_type_remove_toggle_binary',
        0x04: 'specific_type_remote_toggle_multilevel'
      }
    },
    0x13: {
      generic: 'generic_type_switch_toggle',
      specific: {
        0x01: 'specific_type_switch_toggle_binary',
        0x02: 'specific_type_switch_toggle_multilevel'
      }
    },
    0x14: {
      generic: 'generic_type_zip_gateway',
      specific: {
        0x01: 'specific_type_zip_tun_gateway',
        0x02: 'specific_type_zip_adv_gateway'
      }
    },
    0x15: {
      generic: 'generic_type_zip_node',
      specific: {
        0x01: 'specific_type_zip_tun_node',
        0x02: 'specific_type_zip_adv_node'
      }
    },
    0x16: {
      generic: 'generic_type_ventilation',
      specific: {
        0x01: 'specific_type_residential_hrv'
      }
    },
    0x17: {
      generic: 'generic_type_security_panel',
      specific: {
        0x01: 'specific_type_zoned_security_panel'
      }
    },
    0x18: {
      generic: 'generic_type_wall_controller',
      specific: {
        0x01: 'specific_type_basic_wall_controller'
      }
    },
    0x20: {
      generic: 'generic_type_sensor_binary',
      specific: {
        0x01: 'specific_type_routing_sensor_binary'
      }
    },
    0x21: {
      generic: 'generic_type_sensor_multilevel',
      specific: {
        0x01: 'specific_type_routing_sensor_multilevel',
        0x02: 'specific_type_chimney_fan'
      }
    },
    0x30: {
      generic: 'generic_type_meter_pulse',
      specific: {}
    },
    0x31: {
      generic: 'generic_type_meter',
      specific: {
        0x01: 'specific_type_simple_meter',
        0x02: 'specific_type_adv_energy_control',
        0x03: 'specific_type_whole_home_meter_simple'
      }
    },
    0x40: {
      generic: 'generic_type_entry_control',
      specific: {
        0x01: 'specific_type_door_lock',
        0x02: 'specific_type_advanced_door_lock',
        0x03: 'specific_type_secure_keypad_door_lock',
        0x04: 'specific_type_secure_keypad_door_lock_deadbolt',
        0x05: 'specific_type_secure_door',
        0x06: 'specific_type_secure_gate',
        0x07: 'specific_type_secure_barrier_addon',
        0x08: 'specific_type_secure_barrier_open_only',
        0x09: 'specific_type_secure_barrier_close_only',
        0x0a: 'specific_type_secure_lockbox',
        0x0b: 'specific_type_secure_keypad'
      }
    },
    0x50: {
      generic: 'generic_type_semi_interoperable',
      specific: {
        0x01: 'specific_type_energy_production'
      }
    },
    0xa1: {
      generic: 'generic_type_sensor_alarm',
      specific: {
        0x01: 'specific_type_basic_routing_alarm_sensor',
        0x02: 'specific_type_routing_alarm_sensor',
        0x03: 'specific_type_basic_zensor_net_alarm_sensor',
        0x04: 'specific_type_zensor_net_alarm_sensor',
        0x05: 'specific_type_adv_zensor_net_alarm_sensor',
        0x06: 'specific_type_basic_routing_smoke_sensor',
        0x07: 'specific_type_routing_smoke_sensor',
        0x08: 'specific_type_basic_zensor_net_smoke_sensor',
        0x09: 'specific_type_zensor_net_smoke_sensor',
        0x0a: 'specific_type_adv_zensor_net_smoke_sensor',
        0x0b: 'specific_type_alarm_sensor'
      }
    },
    0xff: {
      generic: 'generic_type_non_interoperable',
      specific: {}
    }
  },
  genericDeviceClassAttributes (cls) {
    return this._genericDeviceClassMap[cls]
  },
  genericDeviceClass (cls) {
    var clsAttr = this.genericDeviceClassAttributes(cls)
    if (clsAttr) {
      return clsAttr.generic
    } else {
      return 'unknownGenericDeviceType_' + cls
    }
  },
  specificDeviceClass (genericCls, specificCls) {
    var clsAttr = this.genericDeviceClassAttributes(genericCls)
    if (clsAttr) {
      return (
        clsAttr.specific[specificCls] ||
        'unknownSpecificDeviceType_' + specificCls
      )
    } else {
      return 'unknownGenericDeviceType_' + genericCls
    }
  }
}
