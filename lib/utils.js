// eslint-disable-next-line one-var
const appRoot = require('app-root-path'),
  path = require('path')

module.exports = {
  getPath (write) {
    if (write && process.pkg) return process.cwd()
    else return appRoot.toString()
  },
  joinPath (...paths) {
    if (paths.length > 0 && typeof paths[0] === 'boolean') {
      paths[0] = this.getPath(paths[0])
    }
    return path.join(...paths)
  },
  num2hex (num) {
    const hex = num >= 0 ? num.toString(16) : 'XXXX'
    return '0x' + '0'.repeat(4 - hex.length) + hex
  },
  isValueId (v) {
    if (typeof v.commandClass !== 'number' || v.commandClass < 0) {
      return 'invalid `commandClass`'
    }

    if (v.endpoint !== undefined && v.endpoint < 0) {
      return 'invalid `endpoint`'
    }

    if (v.property === undefined || (typeof v.property !== 'string' && typeof v.property !== 'number')) {
      return 'invalid `property`'
    }

    if (v.propertyKey !== undefined && (typeof v.propertyKey !== 'string' && typeof v.propertyKey !== 'number')) {
      return 'invalid `propertyKey`'
    }

    return true
  }
}
