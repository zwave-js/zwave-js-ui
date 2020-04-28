// eslint-disable-next-line one-var
var appRoot = require('app-root-path'),
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
  }
}
