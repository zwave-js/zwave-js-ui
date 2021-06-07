import chai from 'chai'
// const sinon = require('sinon')
// const _ = require('lodash')
// eslint-disable-next-line @typescript-eslint/no-var-requires
chai.use(require('sinon-chai'))
chai.should()

import * as mod from '../../lib/Constants'

describe('#Constants', () => {
	describe('#productionType()', () => {
		it('known', () =>
			mod.productionType(1).should.deep.equal({
				objectId: 'total',
				props: { device_class: 'power' },
				sensor: 'energy_production',
			}))
		it('unknown', () =>
			mod.productionType(4).should.deep.equal({
				objectId: 'unknown',
				props: { device_class: 'power' },
				sensor: 'energy_production',
			}))
		it('timestamp', () =>
			mod.productionType(3).should.deep.equal({
				objectId: 'time',
				props: { device_class: 'timestamp' },
				sensor: 'energy_production',
			}))
	})
	// describe('#meterType()', () => {
	//   let sensorType
	//   const map = mod._metersMap
	//   before(() => {
	//     sensorType = sinon.stub(mod, 'sensorType').returns({})
	//     mod._metersMap = { 1: 'foo' }
	//   })
	//   after(() => {
	//     mod._metersMap = map
	//     sensorType.restore()
	//   })
	//   it('known', () =>
	//     mod.meterType(1).should.deep.equal({ objectId: 'foo_meter' }))
	//   it('unknown', () =>
	//     mod.meterType(2).should.deep.equal({ objectId: 'unknown_meter' }))
	//   describe('electricity', () => {
	//     before(() => {
	//       sensorType.resetHistory()
	//       _.range(1, 16).forEach(i => mod.meterType(i))
	//       mod.meterType(48)
	//       mod.meterType(64)
	//     })
	//     it('electricity', () => sensorType.should.always.have.been.calledWith(4))
	//   })
	//   describe('gas', () => {
	//     before(() => {
	//       sensorType.resetHistory()
	//       _.range(16, 32).forEach(i => mod.meterType(i))
	//     })
	//     it('gas', () => sensorType.should.always.have.been.calledWith(55))
	//   })
	//   describe('water', () => {
	//     before(() => {
	//       sensorType.resetHistory()
	//       _.range(32, 48).forEach(i => mod.meterType(i))
	//     })
	//     it('water', () => sensorType.should.always.have.been.calledWith(12))
	//   })
	// })
	describe('#sensorType()', () => {
		it('known', () =>
			mod.sensorType(1).should.deep.equal({
				sensor: 'temperature',
				objectId: 'air',
				props: { device_class: 'temperature' },
			}))
		it('no props', () =>
			mod.sensorType(2).should.deep.equal({
				sensor: 'generic',
				objectId: 'general_purpose',
				props: {},
			}))
		it('unknown', () =>
			mod.sensorType(90).should.deep.equal({
				sensor: 'generic',
				objectId: 'unknown_90',
				props: {},
			}))
	})
	describe('#commandClass()', () => {
		it('known', () => mod.commandClass(0).should.equal('no_operation'))
		it('unknown', () =>
			mod.commandClass(-1).should.equal('unknownClass_-1'))
	})
	describe('#genericDeviceClass()', () => {
		it('known generic type', () =>
			mod
				.genericDeviceClass(1)
				.should.equal('generic_type_generic_controller'))
		it('unknown generic type', () =>
			mod
				.genericDeviceClass(-1)
				.should.equal('unknownGenericDeviceType_-1'))
	})
	describe('#specificDeviceClass()', () => {
		it('known specific type', () =>
			mod
				.specificDeviceClass(1, 1)
				.should.equal('specific_type_portable_controller'))
		it('unknown specific type', () =>
			mod
				.specificDeviceClass(1, 8)
				.should.equal('unknownSpecificDeviceType_8'))
		it('unknown generic type 260', () =>
			mod
				.specificDeviceClass(260, 1)
				.should.equal('unknownGenericDeviceType_260'))
	})
})
