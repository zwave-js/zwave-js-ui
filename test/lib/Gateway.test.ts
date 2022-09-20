import chai, { expect } from 'chai'
import Gateway, { closeWatchers } from '../../lib/Gateway'
import { ZUINode } from '../../lib/ZwaveClient'
// eslint-disable-next-line @typescript-eslint/no-var-requires
chai.use(require('sinon-chai'))

describe('#Gateway', () => {
	const gw = new Gateway({ type: 0 }, null, null)
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
					node as unknown as ZUINode
				)
				return expect(payload).to.deep.equal(untouchedPayload)
			})
		})
		describe('no valueId', () => {
			it('should not change payload', () => {
				gw['_setDiscoveryValue'](
					payload,
					'd',
					node as unknown as ZUINode
				)
				return expect(payload).to.deep.equal(untouchedPayload)
			})
		})
		describe('no valueId.value', () => {
			it('should not change payload', () => {
				gw['_setDiscoveryValue'](
					payload,
					'c',
					node as unknown as ZUINode
				)
				return expect(payload).to.deep.equal(untouchedPayload)
			})
		})
		describe('happy path', () => {
			it('should not change payload', () => {
				gw['_setDiscoveryValue'](
					payload,
					'b',
					node as unknown as ZUINode
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
})
