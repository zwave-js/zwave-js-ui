import chai, { expect } from 'chai'
import sinon, { SinonStub } from 'sinon'
import fs from 'fs'
import path from 'path'
import proxyquire from 'proxyquire'

const cssFolder = path.join(__dirname, '..', '..', 'dist', 'static', 'css')
const jsFolder = path.join(__dirname, '..', '..', 'dist', 'static', 'js')
// eslint-disable-next-line @typescript-eslint/no-var-requires
chai.use(require('sinon-chai'))

let lastTpl
let lastOptions

const mockResponse = {
	render: (tpl, options) => {
		lastTpl = tpl
		lastOptions = options
	},
}

describe('#renderIndex', () => {
	describe('Processing configuration', () => {
		const renderIndex = proxyquire('../../lib/renderIndex.ts', {
			'../config/webConfig': {
				webConfig: {
					base: '/configured/path',
				},
			},
		})
		let mockedReaddir: SinonStub

		beforeEach(() => {
			mockedReaddir = sinon.stub(fs, 'readdirSync')
			mockedReaddir.returns([])
		})

		afterEach(() => {
			mockedReaddir.restore()
			renderIndex.resetFiles()
		})

		it('uses the base from the `X-External-Path` header', () => {
			renderIndex.default(
				{
					headers: {
						'x-external-path': '/test/base',
					},
				},
				mockResponse
			)
			return expect(lastOptions.config.base).to.equal('/test/base/')
		})

		it('uses configured value if no header is present', () => {
			renderIndex.default(
				{
					headers: {},
				},
				mockResponse
			)
			expect(lastOptions.config.base).to.equal('/configured/path/')
		})
	})

	describe('Processing static files', () => {
		const renderIndex = proxyquire('../../lib/renderIndex.ts', {
			'../config/webConfig': {
				webConfig: {
					base: '/configured/path',
				},
			},
		})

		let mockedReaddir: SinonStub

		beforeEach(() => {
			mockedReaddir = sinon.stub(fs, 'readdirSync')
		})

		afterEach(() => {
			mockedReaddir.restore()
			renderIndex.resetFiles()
		})

		it('When no dist files present it will have empty css and js files', () => {
			mockedReaddir.returns([])
			renderIndex.default(
				{
					headers: {},
				},
				mockResponse
			)
			expect(lastTpl).to.equal('index.ejs')
			expect(lastOptions.cssFiles).to.eql([])
			return expect(lastOptions.jsFiles).to.eql([])
		})

		it('When dist files present will only return the ones with the correct extensions', () => {
			mockedReaddir
				.withArgs(cssFolder)
				.returns(['valid-css.css', 'invalid-css.scss'])
			mockedReaddir
				.withArgs(jsFolder)
				.returns(['valid-js.js', 'invalid-js.map'])
			renderIndex.default(
				{
					headers: {},
				},
				mockResponse,
				true
			)
			expect(lastTpl).to.equal('index.ejs')
			expect(lastOptions.cssFiles).to.eql(['static/css/valid-css.css'])
			return expect(lastOptions.jsFiles).to.eql(['static/js/valid-js.js'])
		})
	})
})
