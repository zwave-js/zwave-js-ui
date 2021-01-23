// eslint-disable-next-line one-var
const appRoot = require('app-root-path')
const path = require('path')
const { version } = require('../package.json')

let VERSION

/**
 *  Get the base root path to application directory. When we are in a `pkg` environment
 *  the path of the snapshot is not writable
 *
 * @param {boolean} write
 * @returns {string}
 */
function getPath (write) {
  if (write && process.pkg) return process.cwd()
  else return appRoot.toString()
}

/**
 * path.join wrapper, the first option can be a boolean and it will automatically fetch the root path
 * passing the boolean to getPath
 *
 * @param {boolean | string} write
 * @param {string[]} paths
 * @returns {string} the result of path join
 */
function joinPath (write, ...paths) {
  if (typeof write === 'boolean') {
    write = getPath(write)
  }
  return path.join(write, ...paths)
}

/**
 * Join props with a `_` and skips undefined props
 *
 * @param {string[]} props the array of props to join
 * @returns {string} The result string with joined props
 */
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

/**
 * Checks if an object is a valueId, returns error otherwise
 *
 * @param {import('zwave-js').ValueID} v the object
 * @returns {boolean|string} Returns true if it's a valid valueId, an error string otherwise
 */
function isValueId (v) {
  if (typeof v.commandClass !== 'number' || v.commandClass < 0) {
    return 'invalid `commandClass`'
  }
  if (v.endpoint !== undefined && v.endpoint < 0) {
    return 'invalid `endpoint`'
  }
  if (
    v.property === undefined ||
    (typeof v.property !== 'string' && typeof v.property !== 'number')
  ) {
    return 'invalid `property`'
  }
  if (
    v.propertyKey !== undefined &&
    typeof v.propertyKey !== 'string' && typeof v.propertyKey !== 'number'
  ) {
    return 'invalid `propertyKey`'
  }
  return true
}

/**
 * Converts a decimal to an hex number of 4 digits and `0x` as prefix
 *
 * @param {number} num the number to convert
 * @returns {string} the hex number string with `0x` prefix
 */
function num2hex (num) {
  const hex = num >= 0 ? num.toString(16) : 'XXXX'
  return '0x' + '0'.repeat(4 - hex.length) + hex
}

/**
 * Gets the actual package.json version with also the git revision number at the end of it
 *
 * @returns {string} The version
 */
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

/**
 * Sanitize chars of a string to use in a topic
 *
 * @param {string} str The string to sanitize
 * @param {boolean} sanitizeSlash Set it to true to remove `/` chars from the string
 * @returns {string} the sanitized string
 */
function sanitizeTopic (str, sanitizeSlash) {
  if (!isNaN(str) || !str) return str

  if (sanitizeSlash) {
    str = removeSlash(str)
  }

  // replace spaces with '_'
  str = str.replace(/\s/g, '_')
  // remove special chars
  return str.replace(/[+*#\\.'`!?^=(),"%[\]:;{}]+/g, '')
}

/**
 * Removes `/` chars from strings
 *
 * @param {string} str The string
 * @returns {string} the string without `/` chars
 */
function removeSlash (str) {
  return !isNaN(str) ? str : str.replace(/\//g, '-')
}

/**
 * Check if an object has a property
 *
 * @param {*} obj the object
 * @param {string} prop the property
 * @returns {boolean} true if the property exists, false otherwise
 */
function hasProperty (obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop)
}

/**
 * Gets the size in a human readable form starting from bytes
 *
 * @param {number} bytes total bytes
 * @returns {string} the human readable size
 */
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
  isValueId,
  num2hex,
  getVersion,
  sanitizeTopic,
  removeSlash,
  hasProperty,
  humanSize
}
