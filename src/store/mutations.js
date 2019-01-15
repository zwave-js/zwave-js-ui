const GROUPS = ["Tags", "Devices", "Measurements"];

export const state = {
  tags: [],
  selected: [],
  serial_ports: [],
  devices: [],
  clients: [],
  mqtt_clients: [],
  tag_names: [
    { header: 'Tags' },
    { name: 'min', group: 'Tags'},
    { name: 'max', group: 'Tags'},
    { name: 'floor', group: 'Tags'},
    { name: 'zone1', group: 'Tags'},
    { divider: true },
    { header: 'Devices' },
    { name: '_thermostat', group: 'Devices'},
    { name: '_heater', group: 'Devices'},
    { divider: true },
    { header: 'Measurements' },
    { name: 'temperature', group: 'Measurements'},
    { name: 'status', group: 'Measurements'},
    { name: 'power', group: 'Measurements'},
    { name: 'kwh', group: 'Measurements'},
    { name: 'alarm', group: 'Measurements'},
    { name: 'comand', group: 'Measurements'}
  ],
}

export const getters = {
  tags: state => state.tags,
  clients: state => state.clients,
  mqtt_clients: state => state.mqtt_clients,
  selected: state => state.selected,
  tag_names: state => state.tag_names,
  serial_ports: state => state.serial_ports,
  devices: state => state.devices
}

export const actions = {
  init (store, options) {
    store.commit('init', options);

    if(options.config && options.config.tags){
      for (var i = 0; i < options.config.tags.length; i++)
      store.commit('insertInGroup', options.config.tags[i].name);
    }
  },
  addTag (store, newTag) {
    store.commit('addTag', newTag)
    store.commit('insertInGroup', newTag.name)
  },
  addDevice (store, newDevice) {
    store.commit('addDevice', newDevice)
  },
  deleteTag (store,  index) {
    store.commit('deleteTag', index)
  },
  addClient (store, newClient) {
    store.commit('addClient', newClient)
  },
  deleteClient (store, index) {
    store.commit('deleteClient', index)
  },
  addMQTTClient (store, newClient) {
    store.commit('addMQTTClient', newClient)
  },
  deleteMQTTClient (store, index) {
    store.commit('deleteMQTTClient', index)
  },
  updateSelected (store, value){
    store.commit('updateSelected', value)
  },
  insertInGroup (store, name){
    store.commit('insertInGroup', name)
  },

}


export const mutations = {
  init (state, options) {
    var conf = options.config;

    if(conf){
      state.tags = conf.tags || [];

      if(conf.clients)
        state.clients = conf.clients || [];

      if(conf.mqtt_clients)
        state.mqtt_clients = conf.mqtt_clients || [];
    }

    state.selected = [];

    if(options.serial_ports)
      state.serial_ports = options.serial_ports;
    if(options.devices)
      state.devices = options.devices;
  },
  addTag (state, newTag) {
    var tags = state.tags;
    var index = tags.findIndex(t => t._id == newTag._id)
    if(index < 0){
      tags.push(newTag);
    }else{
      for (var k in newTag) {
        tags[index][k] = newTag[k];
      }
    }
  },
  deleteTag (state,  index) {
      state.tags.splice(index, 1);
  },
  addDevice (state, newDevice) {
    var devices = state.devices;
    devices.push(newDevice);
  },
  addClient (state, newClient) {
    var clients = state.clients;
    var index = clients.findIndex(t => t._id == newClient._id)
    if(index < 0){
      clients.push(newClient);
    }else{
      for (var k in newClient) {
        clients[index][k] = newClient[k];
      }
    }
  },
  deleteClient (state,  index) {
      state.clients.splice(index, 1);
  },
  addMQTTClient (state, newClient) {
    var clients = state.mqtt_clients;
    var index = clients.findIndex(t => t._id == newClient._id)
    if(index < 0){
      clients.push(newClient);
    }else{
      for (var k in newClient) {
        clients[index][k] = newClient[k];
      }
    }
  },
  deleteMQTTClient (state,  index) {
      state.mqtt_clients.splice(index, 1);
  },
  updateSelected (state, value){
    state.selected = value;
  },
  insertInGroup (state, name){

    for (var k = 0; k < name.length; k++) {

      var group = (k == name.length - 1) ? GROUPS[2] : (name[k].startsWith("_") ? GROUPS[1] : GROUPS[0]);

      if(!state.tag_names.find(t => t.group == group && t.name == name[k])){
        var item = {group: group, name: name[k]};
        var index = state.tag_names.findIndex(t => t.header == item.group);
        if(index >= 0)
        state.tag_names.splice(index+1, 0, item);
      }
    }

  },
}
