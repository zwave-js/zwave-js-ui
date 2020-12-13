// FIXME: This comes from /lib/SocketManager.js. It cannot be imported as it's commonjs module and require isn't supported by webpack

// events from client ---> server
export const inboundEvents = {
  init: 'INITED', // get all nodes
  zwave: 'ZWAVE_API', // call a zwave api
  hass: 'HASS_API' // call an hass api
}

// events from server ---> client
export const socketEvents = {
  init: 'INIT', // automatically sent when a new client connects to the socket
  controller: 'CONTROLLER_CMD', // controller status updates
  connected: 'CONNECTED', // socket status
  nodeRemoved: 'NODE_REMOVED',
  nodeUpdated: 'NODE_UPDATED',
  valueUpdated: 'VALUE_UPDATED',
  valueRemoved: 'VALUE_REMOVED',
  api: 'API_RETURN', // api results
  debug: 'DEBUG'
}
