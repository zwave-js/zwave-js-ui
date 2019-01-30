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
  init (store, data) {
    if(data){
      store.commit('initSettings', data.settings);
      store.commit('initPorts', data.serial_ports);
      store.commit('initDevices', data.devices);
    }
  },
  import (store, settings) {
    store.commit('initSettings', settings);
  }
}

export const mutations = {
  initSettings(state, conf){
    if(conf){
      state.zwave = conf.zwave || {};
      state.mqtt = conf.mqtt || {};
      state.gateway = conf.gateway || {};
    }
  },
  initPorts(state, ports){
      state.serial_ports = ports || [];
  },
  initDevices(state, devices) {

    if(!state.gateway.values) state.gateway.values = [];

    if(devices){
      // devices is an object where key is the device ID and value contains
      // device informations
      for (var k in devices) {
        var d = devices[k];
        d.value = k;

        var values = [];

        // device.values is an object where key is the valueID (cmdClass-instance-index) and value contains
        // value informations
        for(var id in d.values){
          var val = d.values[id];
          values.push(val)
        }

        d.values = values;

        state.devices.push(d)
      }
    }
  }
}
