export const state = {
  serial_ports: [],
  zwave: {},
  mqtt: {},
  devices: [],
  gateway: {}
}

export const getters = {
  serial_ports: state => state.serial_ports,
  zwave: state => state.zwave,
  mqtt: state => state.mqtt,
  devices: state => state.devices,
  gateway: state => state.gateway
}

export const actions = {
  init (store, options) {
    store.commit('init', options);
  }
}

export const mutations = {
  init (state, options) {
    var conf = options.config;

    if(conf){
      state.zwave = conf.zwave || {};
      state.mqtt = conf.mqtt || {};
      state.gateway = conf.gateway || {};
    }

    if(!state.gateway.values) state.gateway.values = [];

    if(options.devices){
      for (var k in options.devices) {
        var d = options.devices[k];
        d.value = k;

        var values = []

        for(var id in d.values){
          var val = d.values[id];
          val.value_id = id;
          values.push(val)
        }

        d.values = values;

        state.devices.push(d)
      }
    }

    if(options.serial_ports)
      state.serial_ports = options.serial_ports;

  }
}
