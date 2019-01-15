const GROUPS = ["Tags", "Devices", "Measurements"];

export const state = {
  serial_ports: [],
  zwave: {},
  mqtt: {},
  general: {}
}

export const getters = {
  serial_ports: state => state.serial_ports,
  zwave: state => state.zwave,
  mqtt: state => state.mqtt,
  general: state => state.general
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
      state.general = conf.general || {};
    }

    if(options.serial_ports)
      state.serial_ports = options.serial_ports;

  }
}
