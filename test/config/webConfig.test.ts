// @ts-expect-error ts-migrate(2451) FIXME: Cannot redeclare block-scoped variable 'chai'.
const chai = require('chai')
const proxyquire = require('proxyquire')

chai.use(require('sinon-chai'))
chai.should()

// @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'describe'. Do you need to instal... Remove this comment to see the full error message
describe('#webConfig', () => {
  const webConfig = proxyquire('../../config/webConfig', {
    './app': {}
  })

  // @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'describe'. Do you need to instal... Remove this comment to see the full error message
  describe('Uses defaults if nothing specified', () => {
    // @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'it'. Do you need to install type... Remove this comment to see the full error message
    it('uses "/" as the default base', () => {
      webConfig.base.should.equal('/')
    })
    // @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'it'. Do you need to install type... Remove this comment to see the full error message
    it('uses "ZWave To MQTT" as the default title', () => {
      webConfig.title.should.equal('ZWave To MQTT')
    })
  })
  // @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'describe'. Do you need to instal... Remove this comment to see the full error message
  describe('Uses config values when pecified', () => {
    const webConfig = proxyquire('../../config/webConfig', {
      './app': {
        base: '/sub/path/',
        title: 'Custom Title'
      }
    })

    // @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'it'. Do you need to install type... Remove this comment to see the full error message
    it('uses "/sub/path/" as the custom base', () => {
      webConfig.base.should.equal('/sub/path/')
    })

    // @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'it'. Do you need to install type... Remove this comment to see the full error message
    it('uses "Custom Title" as the custom title', () => {
      webConfig.title.should.equal('Custom Title')
    })
  })

  // @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'describe'. Do you need to instal... Remove this comment to see the full error message
  describe('Path normalization', () => {
    const webConfig = proxyquire('../../config/webConfig', {
      './app': {
        base: '/sub/path'
      }
    })
    // @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'it'. Do you need to install type... Remove this comment to see the full error message
    it('Ensures base paths ends with a slash', () => {
      webConfig.base.should.equal('/sub/path/')
    })
  })
})
