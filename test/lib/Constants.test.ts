// @ts-expect-error ts-migrate(2451) FIXME: Cannot redeclare block-scoped variable 'chai'.
const chai = require('chai')
// @ts-expect-error ts-migrate(2451) FIXME: Cannot redeclare block-scoped variable 'sinon'.
const sinon = require('sinon')
const _ = require('lodash')
chai.use(require('sinon-chai'))
chai.should()

// @ts-expect-error ts-migrate(2451) FIXME: Cannot redeclare block-scoped variable 'mod'.
const mod = require('../../lib/Constants')

// @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'describe'. Do you need to instal... Remove this comment to see the full error message
describe('#Constants', () => {
  // @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'describe'. Do you need to instal... Remove this comment to see the full error message
  describe('#productionType()', () => {
    let map: any
    // @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'before'.
    before(() => {
      map = mod._productionMap
      mod._productionMap = { 1: 'foo' }
    })
    // @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'after'.
    after(() => {
      mod._productionMap = map
    })
    // @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'it'. Do you need to install type... Remove this comment to see the full error message
    it('known', () =>
      mod.productionType(1).should.deep.equal({
        objectId: 'foo',
        props: { device_class: 'power' },
        sensor: 'energy_production'
      }))
    // @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'it'. Do you need to install type... Remove this comment to see the full error message
    it('unknown', () =>
      mod.productionType(2).should.deep.equal({
        objectId: 'unknown',
        props: { device_class: 'power' },
        sensor: 'energy_production'
      }))
    // @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'it'. Do you need to install type... Remove this comment to see the full error message
    it('timestamp', () =>
      mod.productionType(3).should.deep.equal({
        objectId: 'unknown',
        props: { device_class: 'timestamp' },
        sensor: 'energy_production'
      }))
  })
  // @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'describe'. Do you need to instal... Remove this comment to see the full error message
  describe('#meterType()', () => {
    let sensorType: any
    const map = mod._metersMap
    // @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'before'.
    before(() => {
      sensorType = sinon.stub(mod, 'sensorType').returns({})
      mod._metersMap = { 1: 'foo' }
    })
    // @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'after'.
    after(() => {
      mod._metersMap = map
      sensorType.restore()
    })
    // @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'it'. Do you need to install type... Remove this comment to see the full error message
    it('known', () =>
      mod.meterType(1).should.deep.equal({ objectId: 'foo_meter' }))
    // @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'it'. Do you need to install type... Remove this comment to see the full error message
    it('unknown', () =>
      mod.meterType(2).should.deep.equal({ objectId: 'unknown_meter' }))
    // @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'describe'. Do you need to instal... Remove this comment to see the full error message
    describe('electricity', () => {
      // @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'before'.
      before(() => {
        sensorType.resetHistory()
        _.range(1, 16).forEach((i: any) => mod.meterType(i))
        mod.meterType(48)
        mod.meterType(64)
      })
      // @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'it'. Do you need to install type... Remove this comment to see the full error message
      it('electricity', () => sensorType.should.always.have.been.calledWith(4))
    })
    // @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'describe'. Do you need to instal... Remove this comment to see the full error message
    describe('gas', () => {
      // @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'before'.
      before(() => {
        sensorType.resetHistory()
        _.range(16, 32).forEach((i: any) => mod.meterType(i))
      })
      // @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'it'. Do you need to install type... Remove this comment to see the full error message
      it('gas', () => sensorType.should.always.have.been.calledWith(55))
    })
    // @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'describe'. Do you need to instal... Remove this comment to see the full error message
    describe('water', () => {
      // @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'before'.
      before(() => {
        sensorType.resetHistory()
        _.range(32, 48).forEach((i: any) => mod.meterType(i))
      })
      // @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'it'. Do you need to install type... Remove this comment to see the full error message
      it('water', () => sensorType.should.always.have.been.calledWith(12))
    })
  })
  // @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'describe'. Do you need to instal... Remove this comment to see the full error message
  describe('#alarmType()', () => {
    let map: any
    // @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'before'.
    before(() => {
      map = mod._alarmMap
      mod._alarmMap = { 1: 'foo' }
    })
    // @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'after'.
    after(() => {
      mod._alarmMap = map
    })
    // @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'it'. Do you need to install type... Remove this comment to see the full error message
    it('known', () => mod.alarmType(1).should.equal('foo'))
    // @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'it'. Do you need to install type... Remove this comment to see the full error message
    it('unknown', () => mod.alarmType(3).should.equal('unknown_3'))
  })
  // @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'describe'. Do you need to instal... Remove this comment to see the full error message
  describe('#sensorType()', () => {
    let map: any
    // @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'before'.
    before(() => {
      map = mod._sensorMap
      mod._sensorMap = {
        foo: { 1: 'bar', props: { a: 'b', c: 'd' } },
        bar: { 2: 'foo' }
      }
    })
    // @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'after'.
    after(() => {
      mod._sensorMap = map
    })
    // @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'it'. Do you need to install type... Remove this comment to see the full error message
    it('known', () =>
      mod.sensorType(1).should.deep.equal({
        sensor: 'foo',
        objectId: 'bar',
        props: { a: 'b', c: 'd' }
      }))
    // @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'it'. Do you need to install type... Remove this comment to see the full error message
    it('no props', () =>
      mod.sensorType(2).should.deep.equal({
        sensor: 'bar',
        objectId: 'foo',
        props: {}
      }))
    // @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'it'. Do you need to install type... Remove this comment to see the full error message
    it('unknown', () =>
      mod.sensorType(3).should.deep.equal({
        sensor: 'generic',
        objectId: 'unknown_3',
        props: {}
      }))
  })
  // @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'describe'. Do you need to instal... Remove this comment to see the full error message
  describe('#commandClass()', () => {
    let map: any
    // @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'before'.
    before(() => {
      map = mod._commandClassMap
      mod._commandClassMap = { 1: 'foo' }
    })
    // @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'after'.
    after(() => {
      mod._commandClassMap = map
    })
    // @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'it'. Do you need to install type... Remove this comment to see the full error message
    it('known', () => mod.commandClass(1).should.equal('foo'))
    // @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'it'. Do you need to install type... Remove this comment to see the full error message
    it('unknown', () => mod.commandClass(3).should.equal('unknownClass_3'))
  })
  // @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'describe'. Do you need to instal... Remove this comment to see the full error message
  describe('#genericDeviceClass()', () => {
    let map: any
    // @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'before'.
    before(() => {
      map = mod._genericDeviceClassMap
      mod._genericDeviceClassMap = {
        1: { generic: 'foo', specific: { 1: 'bar', 2: 'baz' } }
      }
    })
    // @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'after'.
    after(() => {
      mod._genericDeviceClassMap = map
    })
    // @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'it'. Do you need to install type... Remove this comment to see the full error message
    it('known generic type', () =>
      mod.genericDeviceClass(1).should.equal('foo'))
    // @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'it'. Do you need to install type... Remove this comment to see the full error message
    it('unknown generic type', () =>
      mod.genericDeviceClass(3).should.equal('unknownGenericDeviceType_3'))
  })
  // @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'describe'. Do you need to instal... Remove this comment to see the full error message
  describe('#specificDeviceClass()', () => {
    let map: any
    // @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'before'.
    before(() => {
      map = mod._genericDeviceClassMap
      mod._genericDeviceClassMap = {
        1: { generic: 'foo', specific: { 1: 'bar', 2: 'baz' } }
      }
    })
    // @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'after'.
    after(() => {
      mod._genericDeviceClassMap = map
    })
    // @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'it'. Do you need to install type... Remove this comment to see the full error message
    it('known specific type', () =>
      mod.specificDeviceClass(1, 1).should.equal('bar'))
    // @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'it'. Do you need to install type... Remove this comment to see the full error message
    it('unknown specific type', () =>
      mod.specificDeviceClass(1, 3).should.equal('unknownSpecificDeviceType_3'))
    // @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'it'. Do you need to install type... Remove this comment to see the full error message
    it('unknown generic type 1', () =>
      mod.specificDeviceClass(2, 1).should.equal('unknownGenericDeviceType_2'))
    // @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'it'. Do you need to install type... Remove this comment to see the full error message
    it('unknown generic type 2', () =>
      mod.specificDeviceClass(2, 3).should.equal('unknownGenericDeviceType_2'))
  })
})
