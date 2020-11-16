// @ts-expect-error ts-migrate(2451) FIXME: Cannot redeclare block-scoped variable 'chai'.
const chai = require('chai')
// @ts-expect-error ts-migrate(2451) FIXME: Cannot redeclare block-scoped variable 'sinon'.
const sinon = require('sinon')
// @ts-expect-error ts-migrate(2451) FIXME: Cannot redeclare block-scoped variable 'rewire'.
const rewire = require('rewire')
// @ts-expect-error ts-migrate(2451) FIXME: Cannot redeclare block-scoped variable 'fs'.
const fs = require('fs')
// @ts-expect-error ts-migrate(2451) FIXME: Cannot redeclare block-scoped variable 'path'.
const path = require('path')

const cssFolder = path.join(__dirname, '..', '..', 'dist', 'static', 'css')
const jsFolder = path.join(__dirname, '..', '..', 'dist', 'static', 'js')

chai.use(require('sinon-chai'))
chai.should()

let lastTpl: any
let lastOptions: any

const mockResponse = {
  render: (tpl: any, options: any) => {
    lastTpl = tpl
    lastOptions = options
  }
}

// @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'describe'. Do you need to instal... Remove this comment to see the full error message
describe('#renderIndex', () => {
  // @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'describe'. Do you need to instal... Remove this comment to see the full error message
  describe('Processing configuration', () => {
    let renderIndex: any
    let mockedReaddir: any

    // @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'beforeEach'.
    beforeEach(() => {
      renderIndex = rewire('../../lib/renderIndex')
      renderIndex.__set__('webConfig', {
        base: '/configured/path'
      })
      mockedReaddir = sinon.stub(fs, 'readdirSync')
      mockedReaddir.returns([])
    })

    // @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'afterEach'.
    afterEach(() => {
      mockedReaddir.restore()
    })

    // @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'it'. Do you need to install type... Remove this comment to see the full error message
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

    // @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'it'. Do you need to install type... Remove this comment to see the full error message
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

  // @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'describe'. Do you need to instal... Remove this comment to see the full error message
  describe('Processing static files', () => {
    let mockedReaddir: any
    let renderIndex: any

    // @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'beforeEach'.
    beforeEach(() => {
      renderIndex = rewire('../../lib/renderIndex')
      mockedReaddir = sinon.stub(fs, 'readdirSync')
    })

    // @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'afterEach'.
    afterEach(() => {
      mockedReaddir.restore()
    })

    // @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'it'. Do you need to install type... Remove this comment to see the full error message
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

    // @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'it'. Do you need to install type... Remove this comment to see the full error message
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
