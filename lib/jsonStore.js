'use strict'

// eslint-disable-next-line one-var
const jsonfile = require('jsonfile')
const reqlib = require('app-root-path').require
const { storeDir } = reqlib('config/app.js')
const logger = reqlib('/lib/logger.js').module('Store')
const utils = reqlib('lib/utils.js')

async function getFile (config) {
  let err
  let data
  try {
    data = await jsonfile.readFile(utils.joinPath(storeDir, config.file))
  } catch (error) {
    err = error
  }

  // ignore ENOENT error
  if (err) {
    if (err.code !== 'ENOENT') throw err
    else {
      logger.warn(`${config.file} not found`)
    }
  }

  // replace data with default
  if (!data) {
    data = config.default
  }

  return { file: config.file, data: data }
}

/**
Constructor
**/
function StorageHelper () {
  this.store = {}
}

StorageHelper.prototype.init = async function (config) {
  storage_helper.config = config

  for (const model in config) {
    const res = await getFile(config[model])
    storage_helper.store[res.file] = res.data
  }

  return storage_helper.store
}

StorageHelper.prototype.get = function (model) {
  if (storage_helper.store[model.file]) {
    return storage_helper.store[model.file]
  } else {
    throw Error('Requested file not present in store: ' + model.file)
  }
}

StorageHelper.prototype.put = async function (model, data) {
  await jsonfile.writeFile(utils.joinPath(storeDir, model.file), data)
  storage_helper.store[model.file] = data
  return data
}

// eslint-disable-next-line camelcase
const storage_helper = (module.exports = new StorageHelper())
