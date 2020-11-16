const chai = require('chai')
const proxyquire = require('proxyquire')

chai.use(require('sinon-chai'))
chai.should()

describe('#webConfig', () => {
  const webConfig = proxyquire('../../config/webConfig', {
    './app': {}
  })

  describe('Uses defaults if nothing specified', () => {
    it('uses "/" as the default base', () => {
      webConfig.base.should.equal('/')
    })
    it('uses "ZWave To MQTT" as the default title', () => {
      webConfig.title.should.equal('ZWave To MQTT')
    })
  })
  describe('Uses config values when pecified', () => {
    const webConfig = proxyquire('../../config/webConfig', {
      './app': {
        base: '/sub/path/',
        title: 'Custom Title'
      }
    })

    it('uses "/sub/path/" as the custom base', () => {
      webConfig.base.should.equal('/sub/path/')
    })

    it('uses "Custom Title" as the custom title', () => {
      webConfig.title.should.equal('Custom Title')
    })
  })

  describe('Path normalization', () => {
    const webConfig = proxyquire('../../config/webConfig', {
      './app': {
        base: '/sub/path'
      }
    })
    it('Ensures base paths ends with a slash', () => {
      webConfig.base.should.equal('/sub/path/')
    })
  })
})
