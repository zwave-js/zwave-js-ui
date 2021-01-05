export const state = {
  serial_ports: [],
  zwave: {
    port: undefined,
    commandsTimeout: 30,
    networkKey: undefined,
    logLevel: 'info',
    logToFile: false
  },
  mqtt: {
    name: 'zwavejs2mqtt',
    host: 'localhost',
    port: 1883,
    qos: 1,
    prefix: 'zwave',
    reconnectPeriod: 3000,
    retain: true,
    clean: true,
    auth: false,
    username: undefined,
    password: undefined
  },
  devices: [],
  gateway: {
    type: 0,
    payloadType: 0,
    nodeNames: true,
    hassDiscovery: true,
    discoveryPrefix: 'homeassistant',
    logEnabled: true,
    logLevel: 'info',
    logToFile: false
  }
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
    if (data) {
      store.commit('initSettings', data.settings)
      store.commit('initPorts', data.serial_ports)
      store.commit('initDevices', data.devices)
    }
  },
  import (store, settings) {
    store.commit('initSettings', settings)
  }
}

export const mutations = {
  initSettings (state, conf) {
    if (conf) {
      Object.assign(state.zwave, conf.zwave || {})
      Object.assign(state.mqtt, conf.mqtt || {})
      Object.assign(state.gateway, conf.gateway || {})
    }
  },
  initPorts (state, ports) {
    state.serial_ports = ports || []
  },
  initDevices (state, devices) {
    if (!state.gateway.values) state.gateway.values = []

    if (devices) {
      // devices is an object where key is the device ID and value contains
      // device informations
      for (const k in devices) {
        const d = devices[k]
        d.value = k

        const values = []

        // device.values is an object where key is the valueID (cmdClass-instance-index) and value contains
        // value informations
        for (const id in d.values) {
          const val = d.values[id]
          values.push(val)
        }

        d.values = values

        state.devices.push(d)
      }
    }
  }
}
