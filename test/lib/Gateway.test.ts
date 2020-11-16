// @ts-expect-error ts-migrate(2451) FIXME: Cannot redeclare block-scoped variable 'chai'.
const chai = require('chai')
// @ts-expect-error ts-migrate(2451) FIXME: Cannot redeclare block-scoped variable 'rewire'.
const rewire = require('rewire')
chai.use(require('sinon-chai'))
chai.should()

// @ts-expect-error ts-migrate(2451) FIXME: Cannot redeclare block-scoped variable 'mod'.
const mod = rewire('../../lib/Gateway')

// @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'describe'. Do you need to instal... Remove this comment to see the full error message
describe('#Gateway', () => {
  // @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'describe'. Do you need to instal... Remove this comment to see the full error message
  describe('#setDiscoveryValue()', () => {
    let untouchedPayload: any
    const func = mod.__get__('setDiscoveryValue')
    let payload: any
    const node = {
      values: {
        c: { value: 'a' },
        d: { value: null },
        e: false
      }
    }
    // @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'beforeEach'.
    beforeEach(() => {
      payload = {
        a: 1,
        b: 'c',
        c: 'd',
        d: 'e'
      }
      untouchedPayload = JSON.parse(JSON.stringify(payload))
    })

    // @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'describe'. Do you need to instal... Remove this comment to see the full error message
    describe('payload prop not string', () => {
      // @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'it'. Do you need to install type... Remove this comment to see the full error message
      it('should not change payload', () => {
        func(payload, 'a', node)
        payload.should.deep.equal(untouchedPayload)
      })
    })
    // @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'describe'. Do you need to instal... Remove this comment to see the full error message
    describe('no valueId', () => {
      // @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'it'. Do you need to install type... Remove this comment to see the full error message
      it('should not change payload', () => {
        func(payload, 'd', node)
        payload.should.deep.equal(untouchedPayload)
      })
    })
    // @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'describe'. Do you need to instal... Remove this comment to see the full error message
    describe('no valueId.value', () => {
      // @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'it'. Do you need to install type... Remove this comment to see the full error message
      it('should not change payload', () => {
        func(payload, 'c', node)
        payload.should.deep.equal(untouchedPayload)
      })
    })
    // @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'describe'. Do you need to instal... Remove this comment to see the full error message
    describe('happy path', () => {
      // @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'it'. Do you need to install type... Remove this comment to see the full error message
      it('should not change payload', () => {
        func(payload, 'b', node)
        payload.should.deep.equal({
          a: 1,
          b: 'a',
          c: 'd',
          d: 'e'
        })
      })
    })
  })

  // @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'afterEach'.
  afterEach(() => {
    mod.__get__('watchers').forEach((v: any) => {
      if (v != null) {
        v.close()
      }
    })
  })
})
