import { describe, it, expect, beforeEach, vi } from 'vitest'
import { CommandClasses } from '@zwave-js/core'
import nunjucks from 'nunjucks'
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

		const valueConf = (ccConfigEnableDiscovery?: boolean | null) => ({
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

		it('follows the global setting when the per-value flag is unset', () => {
			for (const unset of [undefined, null]) {
				expect(
					discover({
						ccConfigEnabledByDefault: true,
						...valueConf(unset),
					}),
				).to.equal(true)
			}
		})
	})

	describe('#publishDiscovery()', () => {
		it('sends a zero-length payload when deleting a device', () => {
			const mqtt = {
				disabled: false,
				publish: vi.fn(),
				publishEmpty: vi.fn(),
			}
			const gateway = new Gateway(
				{
					type: 1,
					hassDiscovery: true,
					retainedDiscovery: true,
					discoveryPrefix: 'homeassistant',
				},
				null as any,
				mqtt as any,
			)
			closeWatchers()
			vi.spyOn(gateway, 'setDiscovery').mockImplementation(() => {})
			gateway.publishDiscovery(
				{
					discoveryTopic: 'switch/dev/config',
					discovery_payload: {},
				} as any,
				1,
				{ deleteDevice: true },
			)
			expect(mqtt.publish).not.toHaveBeenCalled()
			expect(mqtt.publishEmpty).toHaveBeenCalledWith(
				'switch/dev/config',
				{ qos: 0, retain: true },
				'homeassistant',
			)
		})

		it('retains the removal even when retained discovery is off', () => {
			const mqtt = {
				disabled: false,
				publish: vi.fn(),
				publishEmpty: vi.fn(),
			}
			const gateway = new Gateway(
				{
					type: 1,
					hassDiscovery: true,
					retainedDiscovery: false,
					discoveryPrefix: 'homeassistant',
				},
				null as any,
				mqtt as any,
			)
			closeWatchers()
			vi.spyOn(gateway, 'setDiscovery').mockImplementation(() => {})
			gateway.publishDiscovery(
				{
					discoveryTopic: 'switch/dev/config',
					discovery_payload: {},
				} as any,
				1,
				{ deleteDevice: true },
			)
			expect(mqtt.publishEmpty).toHaveBeenCalledWith(
				'switch/dev/config',
				{ qos: 0, retain: true },
				'homeassistant',
			)
		})
	})

	describe('#removeNodeRetained()', () => {
		it('clears every value topic with a retained empty payload', () => {
			const mqtt = {
				disabled: false,
				publish: vi.fn(),
				publishEmpty: vi.fn(),
			}
			const node = {
				id: 1,
				values: {
					'37-0-currentValue': { id: '1-37-0-currentValue' },
					'38-0-currentValue': { id: '1-38-0-currentValue' },
				},
			}
			const gateway = new Gateway(
				{ type: 1 },
				{ nodes: new Map([[1, node]]) } as any,
				mqtt as any,
			)
			closeWatchers()
			vi.spyOn(gateway, 'valueTopic').mockImplementation(
				(_node, valueId: any) => `topic/${valueId.id}`,
			)
			gateway.removeNodeRetained(1)
			expect(mqtt.publish).not.toHaveBeenCalled()
			expect(mqtt.publishEmpty).toHaveBeenCalledTimes(2)
			expect(mqtt.publishEmpty).toHaveBeenCalledWith(
				'topic/1-37-0-currentValue',
				{ retain: true },
			)
			expect(mqtt.publishEmpty).toHaveBeenCalledWith(
				'topic/1-38-0-currentValue',
				{ retain: true },
			)
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

	describe('#_addRgbColorSwitch()', () => {
		// nunjucks runs the Jinja syntax HA uses; add the Jinja2 min/max and HA to_json filters it lacks
		const jinja = new nunjucks.Environment(null, { autoescape: false })
			.addFilter('min', (a: number[]) => Math.min(...a))
			.addFilter('max', (a: number[]) => Math.max(...a))
			.addFilter('to_json', (v: unknown) => JSON.stringify(v))
		// HA parses a JSON_TIME_VALUE payload into value_json
		const renderState = (template: string, value: unknown) =>
			jinja.renderString(template, { value_json: { time: 1, value } })

		const discover = (values: Record<string, any>) => {
			const gateway = new Gateway(
				{ type: 1, hassDiscovery: true },
				null as any,
				{ getTopic: (t: string) => t } as any,
			)
			closeWatchers()
			vi.spyOn(gateway, 'valueTopic').mockReturnValue({
				topic: 'topic',
				targetTopic: 'topic/set',
			} as any)
			const currentColor = {
				id: '1-51-0-currentColor',
				endpoint: 0,
			} as unknown as ZUIValueId
			return gateway['_addRgbColorSwitch'](
				{ id: 1, values } as unknown as ZUINode,
				currentColor,
			).discovery_payload
		}

		it('maps a Binary Switch state to ON/OFF', () => {
			const payload = discover({
				'37-0-currentValue': {
					id: '1-37-0-currentValue',
					targetValue: '37-0-targetValue',
				},
			})
			const template = payload.state_value_template as string

			expect(renderState(template, true)).to.equal('ON')
			expect(renderState(template, false)).to.equal('OFF')
			// RAW mode rewrites value_json.value to the raw payload string
			const raw = template.replace(/value_json\.value/g, 'value')
			expect(jinja.renderString(raw, { value: 'true' })).to.equal('ON')
			expect(jinja.renderString(raw, { value: 'false' })).to.equal('OFF')
		})

		describe('with white channels', () => {
			const payload = discover({
				'51-0-currentColor-0': { id: '1-51-0-currentColor-0' },
			})
			const color = (rgb: number[], ww: number, cw: number) => ({
				red: rgb[0],
				green: rgb[1],
				blue: rgb[2],
				warmWhite: ww,
				coldWhite: cw,
			})
			const states = (value: unknown) => [
				renderState(payload.rgb_value_template, value),
				renderState(payload.color_temp_value_template, value),
			]

			// HA ignores an empty render, so only one mode updates per message
			it('renders only the template of the active mode', () => {
				expect(states(color([255, 0, 0], 0, 0))).to.deep.equal([
					'255,0,0',
					'',
				])
				expect(states(color([0, 0, 0], 127, 128))).to.deep.equal([
					'',
					'372',
				])
				expect(states(color([0, 255, 0], 100, 100))).to.deep.equal([
					'0,255,0',
					'',
				])
				expect(states(color([0, 0, 0], 0, 0))).to.deep.equal(['', ''])
			})

			it('turns off the other mode and clamps color temp commands', () => {
				const colorTemp = (mireds: number) =>
					JSON.parse(
						jinja.renderString(
							payload.color_temp_command_template,
							{ value: mireds },
						),
					)
				expect(colorTemp(372)).to.deep.equal(color([0, 0, 0], 127, 128))
				expect(colorTemp(153)).to.deep.equal(color([0, 0, 0], 0, 255))
				expect(colorTemp(600)).to.deep.equal(color([0, 0, 0], 255, 0))
				expect(
					JSON.parse(
						jinja.renderString(payload.rgb_command_template, {
							red: 0,
							green: 0,
							blue: 255,
						}),
					),
				).to.deep.equal(color([0, 0, 255], 0, 0))
			})

			it('round-trips color temp commands through the state template', () => {
				for (const mireds of [245, 372, 500]) {
					const sent = JSON.parse(
						jinja.renderString(
							payload.color_temp_command_template,
							{
								value: mireds,
							},
						),
					)
					expect(
						renderState(payload.color_temp_value_template, sent),
					).to.equal(String(mireds))
				}
				expect(payload.min_mireds).to.equal(245)
				expect(payload.max_mireds).to.equal(500)
			})
		})
	})
})
