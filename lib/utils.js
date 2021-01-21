// eslint-disable-next-line one-var
const appRoot = require('app-root-path')
const path = require('path')
const { version } = require('../package.json')

let VERSION

function getPath (write) {
  if (write && process.pkg) return process.cwd()
  else return appRoot.toString()
}

function joinPath (...paths) {
  if (paths.length > 0 && typeof paths[0] === 'boolean') {
    paths[0] = getPath(paths[0])
  }
  return path.join(...paths)
}

function joinProps (...props) {
  props = props || []
  let ret = props[0] || ''
  for (let i = 1; i < props.length; i++) {
    const p = props[i]
    if (p !== null && p !== undefined && p !== '') {
      ret += '_' + p
    }
  }
  return ret
}

function num2hex (num) {
  const hex = num >= 0 ? num.toString(16) : 'XXXX'
  return '0x' + '0'.repeat(4 - hex.length) + hex
}

function getVersion () {
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
}

function sanitizeTopic (str, removeSlash) {
  if (!isNaN(str) || !str) return str

  if (removeSlash) {
    str = removeSlash(str)
  }

  // replace spaces with '_'
  str = str.replace(/\s/g, '_')
  // remove special chars
  return str.replace(/[+*#\\.'`!?^=(),"%[\]:;{}]+/g, '')
}

function removeSlash (str) {
  return !isNaN(str) ? str : str.replace(/\//g, '-')
}

function hasProperty (obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop)
}

function humanSize (bytes) {
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

module.exports = {
  getPath,
  joinPath,
  joinProps,
  num2hex,
  getVersion,
  sanitizeTopic,
  removeSlash,
  hasProperty,
  humanSize
}
