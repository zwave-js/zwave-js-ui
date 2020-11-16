// @ts-expect-error ts-migrate(2451) FIXME: Cannot redeclare block-scoped variable 'fs'.
const fs = require('fs')
// @ts-expect-error ts-migrate(2451) FIXME: Cannot redeclare block-scoped variable 'path'.
const path = require('path')
// @ts-expect-error ts-migrate(2451) FIXME: Cannot redeclare block-scoped variable 'reqlib'.
const reqlib = require('app-root-path').require

const webConfig = reqlib('/config/webConfig')

function findFiles (folder: any, ext: any) {
  const folderPath = path.join(__dirname, '..', 'dist', folder)
  const folderFiles = fs.readdirSync(folderPath)
  return folderFiles
    .filter(function (file: any) {
      return path.extname(file).toLowerCase() === `.${ext.toLowerCase()}`
    })
    .map(function (file: any) {
      return path.join(folder, file)
    });
}

let cssFiles: any
let jsFiles: any

function basePath (config: any, headers: any) {
  return (headers['x-external-path'] || config.base).replace(/\/?$/, '/');
}

module.exports = function (req: any, res: any) {
  cssFiles = cssFiles || findFiles(path.join('static', 'css'), 'css')
  jsFiles = jsFiles || findFiles(path.join('static', 'js'), 'js')
  res.render('index.ejs', {
    config: {
      ...webConfig,
      base: basePath(webConfig, req.headers)
    },
    cssFiles,
    jsFiles
  })
}
