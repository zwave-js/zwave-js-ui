export const state = {
  serial_ports: [],
  zwave: {},
  mqtt: {},
  devices: [],
  gateway: {}
}

export const getters = {
  serial_ports: (state: any) => state.serial_ports,
  zwave: (state: any) => state.zwave,
  mqtt: (state: any) => state.mqtt,
  devices: (state: any) => state.devices,
  gateway: (state: any) => state.gateway
}

export const actions = {
  init (store: any, data: any) {
    if (data) {
      store.commit('initSettings', data.settings)
      store.commit('initPorts', data.serial_ports)
      store.commit('initDevices', data.devices)
    }
  },
  import (store: any, settings: any) {
    store.commit('initSettings', settings)
  }
}

export const mutations = {
  initSettings (state: any, conf: any) {
    if (conf) {
      state.zwave = conf.zwave || {}
      state.mqtt = conf.mqtt || {}
      state.gateway = conf.gateway || {}
    }
  },
  initPorts (state: any, ports: any) {
    state.serial_ports = ports || []
  },
  initDevices (state: any, devices: any) {
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
