/* eslint-disable quotes */
module.exports = {
  '411-1-1': [{
    type: 'climate',
    object_id: 'thermostat',
    values: ['64-1-0', '49-1-1', '67-1-1', '67-1-2'],
    mode_map: {'off': 'Off', 'heat': 'Heat (Default)', 'cool': 'Cool'},
    discovery_payload: {
      min_temp: 15,
      max_temp: 30,
      modes: ['off', 'heat', 'cool'],
      mode_state_topic: '64-1-0',
      mode_state_template: '{{ value_json.value }}',
      mode_command_topic: true,
      current_temperature_topic: '49-1-1',
      current_temperature_template: '{{ value_json.value }}',
      temperature_state_topic: { "Heat (Default)": '67-1-1', "Cool": '67-1-2' },
      temperature_state_template: '{{ value_json.value }}',
      temperature_command_topic: true
    }
  }]
}
