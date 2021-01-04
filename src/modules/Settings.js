/**
 * Type-safe way to store and load settings from localStorage.
 * It supports the data types 'boolean', 'number', 'string' and 'object'.
 */
export class Settings {
  constructor (storage) {
    this.storage = storage || localStorage
  }

  /**
   * Load a setting from the local storage.
   * @param {String} key Key of the setting
   * @param {*} defaultVal Default value of the setting
   * @return Loaded setting
   */
  load (key, defaultVal) {
    const valStr = this.storage.getItem(key)
    const type = typeof defaultVal
    let val
    switch (type) {
      case 'boolean':
        val = valStr === 'false' ? false : valStr === 'true' ? true : defaultVal
        break
      case 'number':
        val = valStr && !isNaN(valStr) ? Number(valStr) : defaultVal
        break
      case 'string':
        val = valStr || valStr === '' ? valStr : defaultVal
        break
      case 'object':
        try {
          val = JSON.parse(valStr)
        } catch (e) {
          val = undefined
        }
        val =
          val && (Object.keys(val).length !== 0 || val.constructor === Object)
            ? val
            : defaultVal
        break
    }
    return val
  }

  /**
   * Store a setting to the local storage.
   * @param {String} key Key of the setting
   * @param {*} val Value of the setting
   */
  store (key, val) {
    let valStr
    if (typeof val === 'object') {
      valStr = JSON.stringify(val)
    } else {
      valStr = String(val)
    }
    this.storage.setItem(key, valStr)
  }
}

export default Settings
