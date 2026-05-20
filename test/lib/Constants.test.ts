import chai, { expect } from 'chai'
// const sinon = require('sinon')
// const _ = require('lodash')

import sinonChai from 'sinon-chai'

chai.use(sinonChai)

import * as mod from '../../api/lib/Constants.ts'

describe('#Constants', () => {
	describe('#productionType()', () => {
		it('known', () =>
			expect(mod.productionType(1)).to.deep.equal({
				objectId: 'total',
				props: { device_class: 'power' },
				sensor: 'energy_production',
			}))
		it('unknown', () =>
			expect(mod.productionType(4)).to.deep.equal({
				objectId: 'unknown',
				props: { device_class: 'power' },
				sensor: 'energy_production',
			}))
		it('timestamp', () =>
			expect(mod.productionType(3)).to.deep.equal({
				objectId: 'time',
				props: { device_class: 'timestamp' },
				sensor: 'energy_production',
			}))
	})
	describe('#sensorType()', () => {
		it('known', () =>
			expect(mod.sensorType(1)).to.deep.equal({
				sensor: 'temperature',
				objectId: 'air',
				props: {
					device_class: 'temperature',
					state_class: 'measurement',
				},
			}))
		it('no props', () =>
			expect(mod.sensorType(2)).to.deep.equal({
				sensor: 'generic',
				objectId: 'general_purpose',
				props: {},
			}))
		it('unknown', () =>
			expect(mod.sensorType(90)).to.deep.equal({
				sensor: 'generic',
				objectId: 'unknown_90',
				props: {},
			}))
	})
	describe('#meterType()', () => {
		it('electric kWh → energy', () => {
			const result = mod.meterType({ meterType: 0x01, scale: 0x00 })
			expect(result.props).to.deep.equal({
				state_class: 'total_increasing',
				device_class: 'energy',
			})
		})
		it('electric W → power', () => {
			const result = mod.meterType({ meterType: 0x01, scale: 0x02 })
			expect(result.props).to.deep.equal({
				state_class: 'measurement',
				device_class: 'power',
			})
		})
		it('electric kVar → reactive_power', () => {
			const result = mod.meterType({ meterType: 0x01, scale: 0x07 })
			expect(result.props).to.deep.equal({
				state_class: 'measurement',
				device_class: 'reactive_power',
			})
		})
		it('electric Power Factor → power_factor', () => {
			const result = mod.meterType({ meterType: 0x01, scale: 0x06 })
			expect(result.props).to.deep.equal({
				state_class: 'measurement',
				device_class: 'power_factor',
				unit_of_measurement: null,
			})
		})
	})
	describe('#deviceClass', () => {
		it('sensor REACTIVE_POWER equals reactive_power', () =>
			expect(mod.deviceClass.sensor.REACTIVE_POWER).to.equal(
				'reactive_power',
			))
		it('sensor APPARENT_POWER equals apparent_power', () =>
			expect(mod.deviceClass.sensor.APPARENT_POWER).to.equal(
				'apparent_power',
			))
		it('sensor CARBON_DIOXIDE equals carbon_dioxide', () =>
			expect(mod.deviceClass.sensor.CARBON_DIOXIDE).to.equal(
				'carbon_dioxide',
			))
		it('existing POWER constant still present', () =>
			expect(mod.deviceClass.sensor.POWER).to.equal('power'))
	})
	describe('#commandClass()', () => {
		it('known', () => expect(mod.commandClass(0)).to.equal('no_operation'))
		it('unknown', () =>
			expect(mod.commandClass(-1)).to.equal('unknownClass_-1'))
	})
	describe('#genericDeviceClass()', () => {
		it('known generic type', () =>
			expect(mod.genericDeviceClass(1)).to.equal(
				'generic_type_generic_controller',
			))
		it('unknown generic type', () =>
			expect(mod.genericDeviceClass(-1)).to.equal(
				'unknownGenericDeviceType_-1',
			))
	})
	describe('#specificDeviceClass()', () => {
		it('known specific type', () =>
			expect(mod.specificDeviceClass(1, 1)).to.equal(
				'specific_type_portable_controller',
			))
		it('unknown specific type', () =>
			expect(mod.specificDeviceClass(1, 8)).to.equal(
				'unknownSpecificDeviceType_8',
			))
		it('unknown generic type 260', () =>
			expect(mod.specificDeviceClass(260, 1)).to.equal(
				'unknownGenericDeviceType_260',
			))
	})
})
