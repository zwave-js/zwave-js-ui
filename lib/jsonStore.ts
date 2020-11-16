'use strict'

// eslint-disable-next-line one-var
const jsonfile = require('jsonfile'),
  // @ts-expect-error ts-migrate(2451) FIXME: Cannot redeclare block-scoped variable 'reqlib'.
  reqlib = require('app-root-path').require,
  // @ts-expect-error ts-migrate(2451) FIXME: Cannot redeclare block-scoped variable 'storeDir'.
  storeDir = reqlib('config/app.js').storeDir,
  // @ts-expect-error ts-migrate(2451) FIXME: Cannot redeclare block-scoped variable 'Promise'.
  Promise = require('bluebird'),
  // @ts-expect-error ts-migrate(2451) FIXME: Cannot redeclare block-scoped variable 'debug'.
  debug = reqlib('/lib/debug')('Store'),
  // @ts-expect-error ts-migrate(2451) FIXME: Cannot redeclare block-scoped variable 'utils'.
  utils = reqlib('lib/utils.js')

debug.color = 3

function getFile (config: any) {
  return new Promise((resolve, reject) => {
    jsonfile.readFile(utils.joinPath(true, storeDir, config.file), function (
      err: any,
      data: any
    ) {
      if (err && err.code !== 'ENOENT') {
        reject(err)
      } else {
        if (err && err.code === 'ENOENT') {
          debug(config.file, 'not found')
        }
        if (!data) {
          data = config.default
        }
        resolve({ file: config.file, data: data })
      }
    })
  });
}

/**
Constructor
**/
function StorageHelper () {
  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  this.store = {}
}

StorageHelper.prototype.init = function (config: any) {
  return new Promise((resolve, reject) => {
    storage_helper.config = config
    // @ts-expect-error ts-migrate(2339) FIXME: Property 'map' does not exist on type 'PromiseCons... Remove this comment to see the full error message
    Promise.map(Object.keys(config), function (model: any) {
      return getFile(config[model])
    })
      .then((results: any) => {
        for (let i = 0; i < results.length; i++) {
          storage_helper.store[results[i].file] = results[i].data
        }
        resolve(storage_helper.store)
      })
      .catch((err: any) => reject(err))
  });
}

StorageHelper.prototype.get = function (model: any) {
  if (storage_helper.store[model.file]) {
    return storage_helper.store[model.file]
  } else {
    throw Error('Requested file not present in store: ' + model.file)
  }
}

StorageHelper.prototype.put = function (model: any, data: any) {
  return new Promise((resolve, reject) => {
    jsonfile.writeFile(
      utils.joinPath(true, storeDir, model.file),
      data,
      function (err: any) {
        if (err) {
          reject(err)
        } else {
          storage_helper.store[model.file] = data
          resolve(storage_helper.store[model.file])
        }
      }
    )
  });
}

// @ts-expect-error ts-migrate(7009) FIXME: 'new' expression, whose target lacks a construct s... Remove this comment to see the full error message
// eslint-disable-next-line camelcase
const storage_helper = (module.exports = new StorageHelper())
