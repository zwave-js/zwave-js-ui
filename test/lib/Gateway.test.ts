import { describe, it, expect, beforeEach, vi } from 'vitest'
import { CommandClasses } from '@zwave-js/core'
import Gateway, { closeWatchers } from '../../api/lib/Gateway.ts'
import type { ZUINode, ZUIValueId } from '../../api/lib/ZwaveClient.ts'

describe('#Gateway', () => {
	const gw = new Gateway({ type: 0 }, null as any, null as any)
	closeWatchers()
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
				gw['_setDiscoveryValue'](
					payload,
					'a',
					node as unknown as ZUINode,
				)
				return expect(payload).to.deep.equal(untouchedPayload)
			})
		})
		describe('no valueId', () => {
			it('should not change payload', () => {
				gw['_setDiscoveryValue'](
					payload,
					'd',
					node as unknown as ZUINode,
				)
				return expect(payload).to.deep.equal(untouchedPayload)
			})
		})
		describe('no valueId.value', () => {
			it('should not change payload', () => {
				gw['_setDiscoveryValue'](
					payload,
					'c',
					node as unknown as ZUINode,
				)
				return expect(payload).to.deep.equal(untouchedPayload)
			})
		})
		describe('happy path', () => {
			it('should not change payload', () => {
				gw['_setDiscoveryValue'](
					payload,
					'b',
					node as unknown as ZUINode,
				)
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
		beforeEach(() => {
			gw['_zwave'] = { homeHex: 'abcdef01' } as any
		})

		const baseNode = {
			id: 7,
			manufacturer: 'Zooz',
			productDescription: 'Dimmer Switch',
			productLabel: 'ZEN77',
			firmwareVersion: '1.2.3',
		} as ZUINode

		it('omits suggested_area by default', () => {
			const deviceInfo = gw['_deviceInfo'](
				{ ...baseNode, loc: 'Kitchen' },
				'Kitchen Dimmer',
			)

			expect(deviceInfo).to.not.have.property('suggested_area')
		})

		it('sets suggested_area when enabled and location exists', () => {
			const gwWithSuggestedArea = new Gateway(
				{ type: 0, useLocationAsSuggestedArea: true },
				null as any,
				null as any,
			)
			gwWithSuggestedArea['_zwave'] = { homeHex: 'abcdef01' } as any

			const deviceInfo = gwWithSuggestedArea['_deviceInfo'](
				{ ...baseNode, loc: 'Kitchen' },
				'Kitchen Dimmer',
			)

			expect(deviceInfo.suggested_area).to.equal('Kitchen')
			closeWatchers()
		})

		it('trims suggested_area and omits blank locations', () => {
			const gwWithSuggestedArea = new Gateway(
				{ type: 0, useLocationAsSuggestedArea: true },
				null as any,
				null as any,
			)
			gwWithSuggestedArea['_zwave'] = { homeHex: 'abcdef01' } as any

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
			closeWatchers()
		})
	})

	describe('#discoverValue() Configuration CC', () => {
		const vId = '112-0-3'
		const configValue = {
			id: `1-${vId}`,
			nodeId: 1,
			commandClass: CommandClasses.Configuration,
			endpoint: 0,
			property: 3,
			propertyName: 'LED mode',
			type: 'number',
			min: 0,
			max: 5,
			writeable: true,
		} as unknown as ZUIValueId

		const discover = (config: Record<string, any>) => {
			const gateway = new Gateway(
				{ type: 1, hassDiscovery: true, values: [], ...config },
				{ homeHex: 'abcdef01' } as any,
				{ disabled: false, getTopic: (t: string) => t } as any,
			)
			closeWatchers()
			gateway['discovered'] = {}
			const publish = vi
				.spyOn(gateway, 'publishDiscovery')
				.mockImplementation(() => {})
			vi.spyOn(gateway, 'setDiscoveryAvailability').mockImplementation(
				() => {},
			)
			const node = {
				id: 1,
				deviceId: 'dev-1',
				name: 'switch',
				ready: true,
				values: { [vId]: configValue },
				endpoints: [],
				deviceClass: {},
				hassDevices: {},
			} as unknown as ZUINode
			gateway.discoverValue(node, vId)
			return publish.mock.calls[0][0].discovery_payload.enabled_by_default
		}

		const valueConf = (ccConfigEnableDiscovery: boolean) => ({
			values: [
				{
					device: 'dev-1',
					value: { id: vId },
					ccConfigEnableDiscovery,
				},
			],
		})

		it('is disabled by default', () => {
			expect(discover({})).to.equal(false)
		})

		it('follows the global setting', () => {
			expect(discover({ ccConfigEnabledByDefault: true })).to.equal(true)
		})

		it('lets the per-value flag override the global setting', () => {
			expect(
				discover({
					ccConfigEnabledByDefault: true,
					...valueConf(false),
				}),
			).to.equal(false)
			expect(discover(valueConf(true))).to.equal(true)
		})
	})

	describe('#parsePayload()', () => {
		const targetValue = (commandClass: CommandClasses) =>
			({
				id: `1-${commandClass}-0-targetValue-13`,
				nodeId: 1,
				commandClass,
				endpoint: 0,
				property: 'targetValue',
				propertyKey: 13,
				type: 'number',
			}) as unknown as ZUIValueId

		let writeValue: ReturnType<typeof vi.fn>

		beforeEach(() => {
			writeValue = vi.fn(() => Promise.resolve())
			gw['_zwave'] = { writeValue } as any
			gw['discovered'] = {}
		})

		it('stops an ongoing Window Covering level change', () => {
			const valueId = targetValue(CommandClasses['Window Covering'])
			gw['discovered'][valueId.id] = {
				type: 'cover',
				discovery_payload: { payload_stop: 'stop' },
			} as any

			expect(gw.parsePayload('stop', valueId, null)).to.equal(null)
			expect(writeValue).toHaveBeenCalledWith(
				expect.objectContaining({
					property: 'levelChangeUp',
					propertyKey: 13,
				}),
				false,
			)
		})

		it('stops an ongoing Multilevel Switch level change', () => {
			const valueId = targetValue(CommandClasses['Multilevel Switch'])
			gw['discovered'][valueId.id] = {
				type: 'cover',
				discovery_payload: { payload_stop: 'stop' },
			} as any

			expect(gw.parsePayload('stop', valueId, null)).to.equal(null)
			expect(writeValue).toHaveBeenCalledWith(
				expect.objectContaining({ property: 'Up' }),
				false,
			)
		})

		it('leaves position payloads untouched', () => {
			const valueId = targetValue(CommandClasses['Window Covering'])
			gw['discovered'][valueId.id] = {
				type: 'cover',
				discovery_payload: { payload_stop: 'stop' },
			} as any

			expect(gw.parsePayload('42', valueId, null)).to.equal('42')
			expect(writeValue).not.toHaveBeenCalled()
		})
	})
})
