module.exports = {
  productionType (index) {
    // https://github.com/OpenZWave/open-zwave/blob/0d94c9427bbd19e47457578bccc60b16c6679b49/config/Localization.xml#L606
    let productionMap = {
      0: 'instant',
      1: 'total',
      2: 'today',
      3: 'time'
    }

    return {
      sensor: 'energy_production',
      objectId: (productionMap[index] || 'unknown'),
      props: {
        device_class: index === 3 ? 'timestamp' : 'power'
      }
    }
  },
  meterType (index) {
    // https://github.com/OpenZWave/open-zwave/blob/0d94c9427bbd19e47457578bccc60b16c6679b49/config/Localization.xml#L679
    // https://github.com/OpenZWave/open-zwave/blob/0d94c9427bbd19e47457578bccc60b16c6679b49/cpp/src/command_classes/Meter.cpp#L74
    let metersMap = {
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
    }

    let cfg = null
    if (index >= 16 && index < 32) { // gas
      cfg = this.sensorType(55)
    } else if (index >= 32 && index < 48) { // water
      cfg = this.sensorType(12)
    } else { // electricity
      cfg = this.sensorType(4)
    }

    cfg.objectId = (metersMap[index] || 'unknown') + '_meter'
    return cfg
  },
  alarmType (index) {
    // https://github.com/OpenZWave/open-zwave/blob/4478eea26b0e1a29184df0515a8034757258ff88/cpp/src/ValueIDIndexesDefines.def#L1068
    // https://github.com/OpenZWave/open-zwave/blob/05a096f75dddd27e3f8dc6af2afdb3cad3b4ebaa/config/Localization.xml#L7
    let alarmMap = {
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
    }

    return alarmMap[index] || ('unknown_' + index)
  },
  sensorType (index) { // https://github.com/OpenZWave/open-zwave/blob/0d94c9427bbd19e47457578bccc60b16c6679b49/config/SensorMultiLevelCCTypes.xml
    let sensorMap = {
      'temperature': {
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
      'illuminance': {
        3: '', // illuminance
        props: {
          device_class: 'illuminance'
        }
      },
      'electricity': {
        4: 'power',
        15: 'voltage',
        16: 'current',
        28: 'resistivity',
        29: 'conductivity',
        props: {
          device_class: 'power'
        }
      },
      'humidity': {
        5: 'air', // humidity
        41: 'soil',
        props: {
          device_class: 'humidity'
        }
      },
      'speed': {
        6: 'velocity', // ?
        52: 'x_acceleration',
        53: 'y_acceleration',
        54: 'z_acceleration',
        props: {
          icon: 'mdi:speedometer'
        }
      },
      'direction': {
        7: '', // direction
        21: 'angle_position', // ?
        props: {
          icon: 'mdi:compass'
        }
      },
      'pressure': {
        8: 'atmospheric',
        9: 'barometric',
        57: 'water',
        props: {
          device_class: 'pressure'
        }
      },
      'sun': {
        10: 'solar_radiation',
        27: 'ultraviolet',
        props: {
          icon: 'mdi:white-balance-sunny'
        }
      },
      'water': {
        12: 'rain_rate',
        13: 'tide_level',
        19: 'tank_capacity',
        56: 'flow',
        props: {
          icon: 'mdi:water'
        }
      },
      'weight': {
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
      'gas': {
        17: 'carbon_dioxide',
        40: 'carbon_monoxide',
        55: 'smoke_density',
        props: {
          icon: 'mdi:thought-bubble'
        }
      },
      'air': {
        18: 'flow',
        props: {
          icon: 'mdi:air-filter'
        }
      },
      'frequency': {
        22: 'rotation',
        32: '',
        props: {}
      },
      'sound': {
        30: 'loudness',
        props: {
          icon: 'mdi:volume-high'
        }
      },
      'signal': {
        58: 'strength',
        props: {
          device_class: 'signal_strength'
        }
      },
      'timestamp': {
        33: '', // time,
        props: {
          device_class: 'timestamp'
        }
      },
      'heart': {
        44: 'rate',
        45: 'blood_pressure',
        50: 'basic_metabolic_rate',
        60: 'respiratory_rate',
        69: 'lf_lh_ratio',
        props: {
          icon: 'mdi:heart'
        }
      },
      'generic': {
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
    }

    let sensorType = {
      sensor: 'generic',
      objectId: 'unknown_' + index,
      props: {}
    }

    for (let sensor in sensorMap) {
      let objectId = sensorMap[sensor][index]
      if (objectId !== undefined) {
        sensorType.sensor = sensor
        sensorType.objectId = objectId
        sensorType.props = sensorMap[sensor].props || {}
        break
      }
    }

    return sensorType
  },
  commandClass (cmd) {
    switch (cmd) {
      case 0x00:
        return 'no_operation'

      case 0x20:
        return 'basic'

      case 0x21:
        return 'controller_replication'

      case 0x22:
        return 'application_status'

      case 0x23:
        return 'zip_services'

      case 0x24:
        return 'zip_server'

      case 0x25:
        return 'switch_binary'

      case 0x26:
        return 'switch_multilevel'

      case 0x27:
        return 'switch_all'

      case 0x28:
        return 'switch_toggle_binary'

      case 0x29:
        return 'switch_toggle_multilevel'

      case 0x2A:
        return 'chimney_fan'

      case 0x2B:
        return 'scene_activation'

      case 0x2C:
        return 'scene_actuator_conf'

      case 0x2D:
        return 'scene_controller_conf'

      case 0x2E:
        return 'zip_client'

      case 0x2F:
        return 'zip_adv_services'

      case 0x30:
        return 'sensor_binary'

      case 0x31:
        return 'sensor_multilevel'

      case 0x32:
        return 'meter'

      case 0x33:
        return 'color'

      case 0x34:
        return 'zip_adv_client'

      case 0x35:
        return 'meter_pulse'

      case 0x3C:
        return 'meter_tbl_config'

      case 0x3D:
        return 'meter_tbl_monitor'

      case 0x3E:
        return 'meter_tbl_pulse'

      case 0x38:
        return 'thermostat_heating'

      case 0x40:
        return 'thermostat_mode'

      case 0x42:
        return 'thermostat_operating_state'

      case 0x43:
        return 'thermostat_setpoint'

      case 0x44:
        return 'thermostat_fan_mode'

      case 0x45:
        return 'thermostat_fan_state'

      case 0x46:
        return 'climate_control_schedule'

      case 0x47:
        return 'thermostat_setback'

      case 0x4C:
        return 'door_lock_logging'

      case 0x4E:
        return 'schedule_entry_lock'

      case 0x50:
        return 'basic_window_covering'

      case 0x51:
        return 'mtp_window_covering'

      case 0x56:
        return 'crc16_encap'

      case 0x5A:
        return 'device_reset_locally'

      case 0x5B:
        return 'central_scene'

      case 0x5E:
        return 'zwave_plus_info'

      case 0x5D:
        return 'antitheft'

      case 0x60:
        return 'multi_instance'

      case 0x62:
        return 'door_lock'

      case 0x63:
        return 'user_code'

      case 0x66:
        return 'barrier_operator'

      case 0x70:
        return 'configuration'

      case 0x71:
        return 'alarm'

      case 0x72:
        return 'manufacturer_specific'

      case 0x73:
        return 'powerlevel'

      case 0x75:
        return 'protection'

      case 0x76:
        return 'lock'

      case 0x77:
        return 'node_naming'

      case 0x79:
        return 'sound_switch'

      case 0x7A:
        return 'firmware_update_md'

      case 0x7B:
        return 'grouping_name'

      case 0x7C:
        return 'remote_association_activate'

      case 0x7D:
        return 'remote_association'

      case 0x80:
        return 'battery'

      case 0x81:
        return 'clock'

      case 0x82:
        return 'hail'

      case 0x84:
        return 'wake_up'

      case 0x85:
        return 'association'

      case 0x86:
        return 'version'

      case 0x87:
        return 'indicator'

      case 0x88:
        return 'proprietary'

      case 0x89:
        return 'language'

      case 0x8A:
        return 'time'

      case 0x8B:
        return 'time_parameters'

      case 0x8C:
        return 'geographic_location'

      case 0x8D:
        return 'composite'

      case 0x8E:
        return 'multi_instance_association'

      case 0x8F:
        return 'multi_cmd'

      case 0x90:
        return 'energy_production'

      case 0x91:
        return 'manufacturer_proprietary'

      case 0x92:
        return 'screen_md'

      case 0x93:
        return 'screen_attributes'

      case 0x94:
        return 'simple_av_control'

      case 0x95:
        return 'av_content_directory_md'

      case 0x96:
        return 'av_renderer_status'

      case 0x97:
        return 'av_content_search_md'

      case 0x98:
        return 'security'

      case 0x99:
        return 'av_tagging_md'

      case 0x9A:
        return 'ip_configuration'

      case 0x9B:
        return 'association_command_configuration'

      case 0x9C:
        return 'sensor_alarm'

      case 0x9D:
        return 'silence_alarm'

      case 0x9E:
        return 'sensor_configuration'

      case 0xEF:
        return 'mark'

      case 0xF0:
        return 'non_interoperable'
    }

    return 'unknownClass_' + cmd
  }
}
