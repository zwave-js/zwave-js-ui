const chai = require('chai')
const rewire = require('rewire')
chai.use(require('sinon-chai'))
chai.should()

const mod = rewire('../../lib/Gateway')

describe('#Gateway', () => {
  describe('#setDiscoveryValue()', () => {
    let untouchedPayload
    const func = mod.__get__('setDiscoveryValue')
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
      untouchedPayload = JSON.parse(JSON.stringify(payload))
    })

    describe('payload prop not string', () => {
      it('should not change payload', () => {
        func(payload, 'a', node)
        payload.should.deep.equal(untouchedPayload)
      })
    })
    describe('no valueId', () => {
      it('should not change payload', () => {
        func(payload, 'd', node)
        payload.should.deep.equal(untouchedPayload)
      })
    })
    describe('no valueId.value', () => {
      it('should not change payload', () => {
        func(payload, 'c', node)
        payload.should.deep.equal(untouchedPayload)
      })
    })
    describe('happy path', () => {
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
})
