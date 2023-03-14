const { logger, zwaveClient, require } = this
const fs = require('fs')
const { join } = require('path')
const { storeDir } = require('../config/app')
// read file
const content = fs.readFileSync(join(storeDir, 'test.log'), 'utf8')

// write file
fs.writeFileSync(join(storeDir, 'test-copy.log'), content)

// read directory
const files = fs.readdirSync(storeDir)