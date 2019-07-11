module.exports = {
  comandClass (cmd) {
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
