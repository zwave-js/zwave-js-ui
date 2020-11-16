// @ts-expect-error ts-migrate(2451) FIXME: Cannot redeclare block-scoped variable 'chai'.
const chai = require('chai')
// @ts-expect-error ts-migrate(2451) FIXME: Cannot redeclare block-scoped variable 'rewire'.
const rewire = require('rewire')
chai.should()

// @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'describe'. Do you need to instal... Remove this comment to see the full error message
describe('#debug', () => {
  const mod = rewire('../../lib/debug')
  const fun = mod.__get__('init')

  // @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'it'. Do you need to install type... Remove this comment to see the full error message
  it('returns debug extend', () => mod('foo').namespace.should.equal('z2m:foo'))

  // @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'describe'. Do you need to instal... Remove this comment to see the full error message
  describe('set process.env.DEBUG', () => {
    // @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'before'.
    before(() => {
      mod.__get__('log').disable()
      process.env.DEBUG = 'ff'
      fun()
    })
    // @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'it'. Do you need to install type... Remove this comment to see the full error message
    it('should disable logging', () =>
      mod.__get__('log').enabled('z2m:aa').should.be.false)
  })
  // @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'describe'. Do you need to instal... Remove this comment to see the full error message
  describe('unset process.env.DEBUG', () => {
    // @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'before'.
    before(() => {
      mod.__get__('log').disable()
      delete process.env.DEBUG
      fun()
    })
    // @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'it'. Do you need to install type... Remove this comment to see the full error message
    it('should enable logging', () => {
      return mod.__get__('log').enabled('z2m:aa').should.be.true
    })
  })
})
