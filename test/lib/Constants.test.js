const chai = require('chai')
const sinon = require('sinon')
const _ = require('lodash')
chai.use(require('sinon-chai'))
chai.should()

const mod = require('../../lib/Constants')

describe('#Constants', () => {
  describe('#productionType()', () => {
    let map
    before(() => {
      map = mod._productionMap
      mod._productionMap = { 1: 'foo' }
    })
    after(() => {
      mod._productionMap = map
    })
    it('known', () =>
      mod.productionType(1).should.deep.equal({
        objectId: 'foo',
        props: { device_class: 'power' },
        sensor: 'energy_production'
      }))
    it('unknown', () =>
      mod.productionType(2).should.deep.equal({
        objectId: 'unknown',
        props: { device_class: 'power' },
        sensor: 'energy_production'
      }))
    it('timestamp', () =>
      mod.productionType(3).should.deep.equal({
        objectId: 'unknown',
        props: { device_class: 'timestamp' },
        sensor: 'energy_production'
      }))
  })
  describe('#meterType()', () => {
    let sensorType
    var map = mod._metersMap
    before(() => {
      sensorType = sinon.stub(mod, 'sensorType').returns({})
      mod._metersMap = { 1: 'foo' }
    })
    after(() => {
      mod._metersMap = map
      sensorType.restore()
    })
    it('known', () =>
      mod.meterType(1).should.deep.equal({ objectId: 'foo_meter' }))
    it('unknown', () =>
      mod.meterType(2).should.deep.equal({ objectId: 'unknown_meter' }))
    describe('electricity', () => {
      before(() => {
        sensorType.resetHistory()
        _.range(1, 16).forEach(i => mod.meterType(i))
        mod.meterType(48)
        mod.meterType(64)
      })
      it('electricity', () => sensorType.should.always.have.been.calledWith(4))
    })
    describe('gas', () => {
      before(() => {
        sensorType.resetHistory()
        _.range(16, 32).forEach(i => mod.meterType(i))
      })
      it('gas', () => sensorType.should.always.have.been.calledWith(55))
    })
    describe('water', () => {
      before(() => {
        sensorType.resetHistory()
        _.range(32, 48).forEach(i => mod.meterType(i))
      })
      it('water', () => sensorType.should.always.have.been.calledWith(12))
    })
  })
  describe('#alarmType()', () => {
    let map
    before(() => {
      map = mod._alarmMap
      mod._alarmMap = { 1: 'foo' }
    })
    after(() => {
      mod._alarmMap = map
    })
    it('known', () => mod.alarmType(1).should.equal('foo'))
    it('unknown', () => mod.alarmType(3).should.equal('unknown_3'))
  })
  describe('#sensorType()', () => {
    let map
    before(() => {
      map = mod._sensorMap
      mod._sensorMap = {
        foo: { 1: 'bar', props: { a: 'b', c: 'd' } },
        bar: { 2: 'foo' }
      }
    })
    after(() => {
      mod._sensorMap = map
    })
    it('known', () =>
      mod.sensorType(1).should.deep.equal({
        sensor: 'foo',
        objectId: 'bar',
        props: { a: 'b', c: 'd' }
      }))
    it('no props', () =>
      mod.sensorType(2).should.deep.equal({
        sensor: 'bar',
        objectId: 'foo',
        props: {}
      }))
    it('unknown', () =>
      mod.sensorType(3).should.deep.equal({
        sensor: 'generic',
        objectId: 'unknown_3',
        props: {}
      }))
  })
  describe('#commandClass()', () => {
    let map
    before(() => {
      map = mod._commandClassMap
      mod._commandClassMap = { 1: 'foo' }
    })
    after(() => {
      mod._commandClassMap = map
    })
    it('known', () => mod.commandClass(1).should.equal('foo'))
    it('unknown', () => mod.commandClass(3).should.equal('unknownClass_3'))
  })
})
