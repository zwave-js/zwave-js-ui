import chai, { expect } from 'chai'
import proxyquire from 'proxyquire'

// eslint-disable-next-line @typescript-eslint/no-var-requires
chai.use(require('sinon-chai'))

describe('#webConfig', () => {
	const { webConfig } = proxyquire('../../config/webConfig', {
		'./app': {},
	})

	describe('Uses defaults if nothing specified', () => {
		it('uses "/" as the default base', () =>
			expect(webConfig.base).to.equal('/'))
		it('uses "ZWaveJS UI" as the default title', () =>
			expect(webConfig.title).to.equal('ZWaveJS UI'))
	})
	describe('Uses config values when pecified', () => {
		const { webConfig } = proxyquire('../../config/webConfig', {
			'./app': {
				base: '/sub/path/',
				title: 'Custom Title',
			},
		})

		it('uses "/sub/path/" as the custom base', () => {
			expect(webConfig.base).to.equal('/sub/path/')
		})

		it('uses "Custom Title" as the custom title', () => {
			expect(webConfig.title).to.equal('Custom Title')
		})
	})

	describe('Path normalization', () => {
		const { webConfig } = proxyquire('../../config/webConfig', {
			'./app': {
				base: '/sub/path',
			},
		})
		it('Ensures base paths ends with a slash', () => {
			expect(webConfig.base).to.equal('/sub/path/')
		})
	})
})
