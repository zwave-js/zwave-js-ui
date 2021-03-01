const proxyquire = require('proxyquire')

describe('#webConfig', () => {
  const webConfig = proxyquire('../../config/webConfig', {
    './app': {}
  })

  describe('Uses defaults if nothing specified', () => {
    test('uses "/" as the default base', () => {
      expect(webConfig.base).toBe('/')
    })
    test('uses "ZWave To MQTT" as the default title', () => {
      expect(webConfig.title).toBe('ZWave To MQTT')
    })
  })
  describe('Uses config values when pecified', () => {
    const webConfig = proxyquire('../../config/webConfig', {
      './app': {
        base: '/sub/path/',
        title: 'Custom Title'
      }
    })

    test('uses "/sub/path/" as the custom base', () => {
      expect(webConfig.base).toBe('/sub/path/')
    })

    test('uses "Custom Title" as the custom title', () => {
      expect(webConfig.title).toBe('Custom Title')
    })
  })

  describe('Path normalization', () => {
    const webConfig = proxyquire('../../config/webConfig', {
      './app': {
        base: '/sub/path'
      }
    })
    test('Ensures base paths ends with a slash', () => {
      expect(webConfig.base).toBe('/sub/path/')
    })
  })
})
