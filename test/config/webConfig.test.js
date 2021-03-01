describe('#webConfig', () => {
  let webConfig

  describe('Uses defaults if nothing specified', () => {
    beforeAll(() => {
      jest.mock('./app', () => ({}))
      webConfig = require('../../config/webConfig')
    })

    afterAll(() => {
      jest.restoreAllMocks()
    })

    test('uses "/" as the default base', () => {
      expect(webConfig.base).toBe('/')
    })
    test('uses "ZWave To MQTT" as the default title', () => {
      expect(webConfig.title).toBe('ZWave To MQTT')
    })
  })
  describe('Uses config values when pecified', () => {
    beforeAll(() => {
      jest.mock('./app', () => ({
        base: '/sub/path/',
        title: 'Custom Title'
      }))
      webConfig = require('../../config/webConfig')
    })

    afterAll(() => {
      jest.restoreAllMocks()
    })

    test('uses "/sub/path/" as the custom base', () => {
      expect(webConfig.base).toBe('/sub/path/')
    })

    test('uses "Custom Title" as the custom title', () => {
      expect(webConfig.title).toBe('Custom Title')
    })
  })

  describe('Path normalization', () => {
    beforeAll(() => {
      jest.mock('./app', () => ({
        base: '/sub/path'
      }))
      webConfig = require('../../config/webConfig')
    })

    afterAll(() => {
      jest.restoreAllMocks()
    })

    test('Ensures base paths ends with a slash', () => {
      expect(webConfig.base).toBe('/sub/path/')
    })
  })
})
