// eslint-disable-next-line one-var
var appRoot = require('app-root-path'),
  path = require('path')

module.exports = {
  getPath (write) {
    if (write && process.pkg) return process.cwd()
    else return appRoot.toString()
  },
  joinPath (...paths) {
    return path.join(...paths)
  }
}
