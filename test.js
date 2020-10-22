const ZWaveClient = require('./lib/ZwaveClient')
var jsonStore = require('./lib/jsonStore.js')
var store = require('./config/store.js')



async function init() {
    await jsonStore.init(store)
    var client = new ZWaveClient({
        port: '/dev/ttyACM0'
    })

    await client.connect()
}


setTimeout(init, 1000)