// eslint-disable-next-line one-var
const appRoot = require('app-root-path')
const path = require('path')
const { version } = require('../package.json')

let VERSION

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
  getVersion () {
    if (!VERSION) {
      let revision
      try {
        revision = require('child_process')
          .execSync('git rev-parse --short HEAD')
          .toString()
          .trim()
      } catch (error) {
        // git not installed
      }
      VERSION = `${version}${revision ? '.' + revision : ''}`
    }

    return VERSION
  },
  hasProperty (obj, prop) {
    return Object.prototype.hasOwnProperty.call(obj, prop)
  },
  humanSize (bytes) {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']

    if (bytes === 0) {
      return 'n/a'
    }

    const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)))

    if (i === 0) {
      return bytes + ' ' + sizes[i]
    }

    return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + sizes[i]
  }
}
