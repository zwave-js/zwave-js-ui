import { afterAll, describe, it, expect, beforeEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { GatewayFactory } from '../../api/hass/GatewayFactory.ts'
import { createFakeGatewayZwave } from './hass/fixtures.ts'

describe('#Gateway', () => {
	const storeDir = mkdtempSync(join(tmpdir(), 'zui-gateway-test-'))
	const factory = new GatewayFactory({
		storeDir,
		logger: {
			error: () => undefined,
			info: () => undefined,
		},
		devices: {},
	})
	const gw = factory.create(
		{ type: 0 },
		createFakeGatewayZwave({ homeHex: 'abcdef01' }),
		null,
	)

	afterAll(() => {
		factory.dispose()
		rmSync(storeDir, { recursive: true, force: true })
	})
	describe('#setDiscoveryValue()', () => {
		let untouchedPayload: Record<string | number, any>
		let payload: Record<string | number, any>
		const node = {
			values: {
				c: { value: 'a' },
				d: { value: null },
				e: false,
			},
		}
		beforeEach(() => {
			payload = {
				a: 1,
				b: 'c',
				c: 'd',
				d: 'e',
			}
			untouchedPayload = JSON.parse(JSON.stringify(payload))
		})

		describe('payload prop not string', () => {
			it('should not change payload', () => {
				gw['_setDiscoveryValue'](payload, 'a', node)
				return expect(payload).to.deep.equal(untouchedPayload)
			})
		})
		describe('no valueId', () => {
			it('should not change payload', () => {
				gw['_setDiscoveryValue'](payload, 'd', node)
				return expect(payload).to.deep.equal(untouchedPayload)
			})
		})
		describe('no valueId.value', () => {
			it('should not change payload', () => {
				gw['_setDiscoveryValue'](payload, 'c', node)
				return expect(payload).to.deep.equal(untouchedPayload)
			})
		})
		describe('happy path', () => {
			it('should not change payload', () => {
				gw['_setDiscoveryValue'](payload, 'b', node)
				return expect(payload).to.deep.equal({
					a: 1,
					b: 'a',
					c: 'd',
					d: 'e',
				})
			})
		})
	})

	describe('#_deviceInfo()', () => {
		const baseNode = {
			id: 7,
			manufacturer: 'Zooz',
			productDescription: 'Dimmer Switch',
			productLabel: 'ZEN77',
			firmwareVersion: '1.2.3',
		}

		it('omits suggested_area by default', () => {
			const deviceInfo = gw['_deviceInfo'](
				{ ...baseNode, loc: 'Kitchen' },
				'Kitchen Dimmer',
			)

			expect(deviceInfo).to.not.have.property('suggested_area')
		})

		it('sets suggested_area when enabled and location exists', () => {
			const gwWithSuggestedArea = factory.create(
				{ type: 0, useLocationAsSuggestedArea: true },
				createFakeGatewayZwave({ homeHex: 'abcdef01' }),
				null,
			)

			const deviceInfo = gwWithSuggestedArea['_deviceInfo'](
				{ ...baseNode, loc: 'Kitchen' },
				'Kitchen Dimmer',
			)

			expect(deviceInfo.suggested_area).to.equal('Kitchen')
		})

		it('trims suggested_area and omits blank locations', () => {
			const gwWithSuggestedArea = factory.create(
				{ type: 0, useLocationAsSuggestedArea: true },
				createFakeGatewayZwave({ homeHex: 'abcdef01' }),
				null,
			)

			const trimmed = gwWithSuggestedArea['_deviceInfo'](
				{ ...baseNode, loc: '  Kitchen  ' },
				'Kitchen Dimmer',
			)
			const blank = gwWithSuggestedArea['_deviceInfo'](
				{ ...baseNode, loc: '   ' },
				'Kitchen Dimmer',
			)

			expect(trimmed.suggested_area).to.equal('Kitchen')
			expect(blank).to.not.have.property('suggested_area')
		})
	})
})
