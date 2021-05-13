const http = require('http')

const availableClients = {
  all: '',
  zwave: '/zwave',
  mqtt: '/mqtt'
}

let clientCheck = availableClients.all

if (process.env.HEALTH_CLIENT) {
  for (const c in availableClients) {
    if (c === process.env.HEALTH_CLIENT) {
      clientCheck = availableClients[c]
      break
    }
  }
}

const options = {
  port: require('./config/app.js').port,
  timeout: 2000,
  path: `/health${clientCheck}`
}

const request = http.request(options, res => {
  console.log(`STATUS: ${res.statusCode}`)
  if (res.statusCode === 200) {
    process.exit(0)
  } else {
    process.exit(1)
  }
})

request.on('error', function (err) {
  console.log('ERROR: ' + err.message)
  process.exit(1)
})

request.end()
