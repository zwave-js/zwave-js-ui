// eslint-disable-next-line one-var
const appRoot = require('app-root-path'),
  // @ts-expect-error ts-migrate(2451) FIXME: Cannot redeclare block-scoped variable 'path'.
  path = require('path')

module.exports = {
  getPath (write: any) {
    // @ts-expect-error ts-migrate(2339) FIXME: Property 'pkg' does not exist on type 'Process'.
    if (write && process.pkg) return process.cwd()
    else return appRoot.toString()
  },
  // @ts-expect-error ts-migrate(7019) FIXME: Rest parameter 'paths' implicitly has an 'any[]' t... Remove this comment to see the full error message
  joinPath (...paths) {
    if (paths.length > 0 && typeof paths[0] === 'boolean') {
      paths[0] = this.getPath(paths[0])
    }
    return path.join(...paths)
  }
}
