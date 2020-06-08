const chai = require('chai')
const sinon = require('sinon')
const rewire = require('rewire')
const fs = require('fs')
const path = require('path')

const cssFolder = path.join(__dirname, '..', '..', 'dist', 'static', 'css')
const jsFolder = path.join(__dirname, '..', '..', 'dist', 'static', 'js')

chai.use(require('sinon-chai'))
chai.should()

let lastTpl
let lastOptions

const mockResponse = {
  render: (tpl, options) => {
    lastTpl = tpl
    lastOptions = options
  }
}

describe('#renderIndex', () => {
  describe('Processing configuration', () => {
    let renderIndex

    beforeEach(() => {
      renderIndex = rewire('../../lib/renderIndex')
      renderIndex.__set__('webConfig', {
        base: '/configured/path'
      })
    })

    it('uses the base from the `X-External-Path` header', () => {
      renderIndex(
        {
          headers: {
            'x-external-path': '/test/base'
          }
        },
        mockResponse
      )
      return lastOptions.config.base.should.equal('/test/base/')
    })

    it('uses configured value if no header is present', () => {
      renderIndex(
        {
          headers: {}
        },
        mockResponse
      )
      lastOptions.config.base.should.equal('/configured/path/')
    })
  })

  describe('Processing static files', () => {
    let mockedReaddir
    let renderIndex

    beforeEach(() => {
      renderIndex = rewire('../../lib/renderIndex')
      mockedReaddir = sinon.stub(fs, 'readdirSync')
    })

    afterEach(() => {
      mockedReaddir.restore()
    })

    it('When no dist files present it will have empty css and js files', () => {
      mockedReaddir.returns([])
      renderIndex(
        {
          headers: {}
        },
        mockResponse
      )
      lastTpl.should.equal('index.ejs')
      lastOptions.cssFiles.should.eql([])
      lastOptions.jsFiles.should.eql([])
    })

    it('When dist files present will only return the ones with the correct extensions', () => {
      mockedReaddir
        .withArgs(cssFolder)
        .returns(['valid-css.css', 'invalid-css.scss'])
      mockedReaddir
        .withArgs(jsFolder)
        .returns(['valid-js.js', 'invalid-js.map'])
      renderIndex(
        {
          headers: {}
        },
        mockResponse
      )
      lastTpl.should.equal('index.ejs')
      lastOptions.cssFiles.should.eql(['static/css/valid-css.css'])
      lastOptions.jsFiles.should.eql(['static/js/valid-js.js'])
    })
  })
})
