const sinon = require('sinon')
const rewire = require('rewire')
const fs = require('fs')
const path = require('path')

const cssFolder = path.join(__dirname, '..', '..', 'dist', 'static', 'css')
const jsFolder = path.join(__dirname, '..', '..', 'dist', 'static', 'js')

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
    let mockedReaddir

    beforeEach(() => {
      renderIndex = rewire('../../lib/renderIndex')
      renderIndex.__set__('webConfig', {
        base: '/configured/path'
      })
      mockedReaddir = sinon.stub(fs, 'readdirSync')
      mockedReaddir.returns([])
    })

    afterEach(() => {
      mockedReaddir.restore()
    })

    test('uses the base from the `X-External-Path` header', () => {
      renderIndex(
        {
          headers: {
            'x-external-path': '/test/base'
          }
        },
        mockResponse
      )
      return expect(lastOptions.config.base).toBe('/test/base/')
    })

    test('uses configured value if no header is present', () => {
      renderIndex(
        {
          headers: {}
        },
        mockResponse
      )
      expect(lastOptions.config.base).toBe('/configured/path/')
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

    test('When no dist files present it will have empty css and js files', () => {
      mockedReaddir.returns([])
      renderIndex(
        {
          headers: {}
        },
        mockResponse
      )
      expect(lastTpl).toBe('index.ejs')
      expect(lastOptions.cssFiles).toEqual([])
      expect(lastOptions.jsFiles).toEqual([])
    })

    test(
      'When dist files present will only return the ones with the correct extensions',
      () => {
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
        expect(lastTpl).toBe('index.ejs')
        expect(lastOptions.cssFiles).toEqual(['static/css/valid-css.css'])
        expect(lastOptions.jsFiles).toEqual(['static/js/valid-js.js'])
      }
    )
  })
})
