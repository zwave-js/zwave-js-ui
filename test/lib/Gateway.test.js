const chai = require('chai')
const rewire = require('rewire')
const { copy } = require('../../lib/utils')
chai.use(require('sinon-chai'))
chai.should()

const mod = rewire('../../lib/Gateway')
const Gateway = mod.__get__('Gateway')

describe('#Gateway', () => {
  const gw = new Gateway()
  describe('#_setDiscoveryValue()', () => {
    let untouchedPayload
    let payload
    const node = {
      values: {
        c: { value: 'a' },
        d: { value: null },
        e: false
      }
    }
    beforeEach(() => {
      payload = {
        a: 1,
        b: 'c',
        c: 'd',
        d: 'e'
      }
      untouchedPayload = copy(payload)
    })

    describe('payload prop not string', () => {
      test('should not change payload', () => {
        gw._setDiscoveryValue(payload, 'a', node)
        payload.should.deep.equal(untouchedPayload)
      })
    })
    describe('no valueId', () => {
      test('should not change payload', () => {
        gw._setDiscoveryValue(payload, 'd', node)
        payload.should.deep.equal(untouchedPayload)
      })
    })
    describe('no valueId.value', () => {
      test('should not change payload', () => {
        gw._setDiscoveryValue(payload, 'c', node)
        payload.should.deep.equal(untouchedPayload)
      })
    })
    describe('happy path', () => {
      test('should not change payload', () => {
        gw._setDiscoveryValue(payload, 'b', node)
        payload.should.deep.equal({
          a: 1,
          b: 'a',
          c: 'd',
          d: 'e'
        })
      })
    })
  })

  afterEach(() => {
    mod.__get__('watchers').forEach(v => {
      if (v != null) {
        v.close()
      }
    })
  })
})
