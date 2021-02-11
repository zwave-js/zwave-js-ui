'use strict'

// eslint-disable-next-line one-var
const jsonfile = require('jsonfile')
const reqlib = require('app-root-path').require
const { storeDir } = reqlib('config/app.js')
const logger = reqlib('/lib/logger.js').module('Store')
const utils = reqlib('lib/utils.js')

function getFile (config) {
  return new Promise((resolve, reject) => {
    jsonfile.readFile(utils.joinPath(storeDir, config.file), function (
      err,
      data
    ) {
      if (err && err.code !== 'ENOENT') {
        reject(err)
      } else {
        if (err && err.code === 'ENOENT') {
          logger.warn(`${config.file} not found`)
        }
        if (!data) {
          data = config.default
        }
        resolve({ file: config.file, data: data })
      }
    })
  })
}

/**
Constructor
**/
function StorageHelper () {
  this.store = {}
}

StorageHelper.prototype.init = function (config) {
  return new Promise((resolve, reject) => {
    storage_helper.config = config
    Promise.map(Object.keys(config), function (model) {
      return getFile(config[model])
    })
      .then(results => {
        for (let i = 0; i < results.length; i++) {
          storage_helper.store[results[i].file] = results[i].data
        }
        resolve(storage_helper.store)
      })
      .catch(err => reject(err))
  })
}

StorageHelper.prototype.get = function (model) {
  if (storage_helper.store[model.file]) {
    return storage_helper.store[model.file]
  } else {
    throw Error('Requested file not present in store: ' + model.file)
  }
}

StorageHelper.prototype.put = function (model, data) {
  return new Promise((resolve, reject) => {
    jsonfile.writeFile(utils.joinPath(storeDir, model.file), data, function (
      err
    ) {
      if (err) {
        reject(err)
      } else {
        storage_helper.store[model.file] = data
        resolve(storage_helper.store[model.file])
      }
    })
  })
}

// eslint-disable-next-line camelcase
const storage_helper = (module.exports = new StorageHelper())
