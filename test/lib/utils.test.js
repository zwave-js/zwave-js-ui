jest.mock('app-root-path', () => 'foo')

const mod = require('../../lib/utils')

describe('#utils', () => {
  describe('#getPath()', () => {
    test('write && process.pkg', () => {
      process.pkg = true
      return expect(mod.getPath(true)).toBe(process.cwd())
    })
    test('write && !process.pkg', () => {
      process.pkg = false
      return expect(mod.getPath(true)).toMatchSnapshot()
    })
    test('!write && process.pkg', () => {
      process.pkg = true
      return expect(mod.getPath(false)).toMatchSnapshot()
    })
    test('!write && !process.pkg', () => {
      process.pkg = false
      return expect(mod.getPath(false)).toMatchSnapshot()
    })
  })
  describe('#joinPath()', () => {
    test('bool true', () =>
      expect(mod.joinPath(true)).toMatchSnapshot())
    test('bool false', () =>
      expect(mod.joinPath(true)).toMatchSnapshot())
    test('1 length', () =>
      expect(mod.joinPath('foobar')).toMatchSnapshot())
    test('first arg bool gets new path 0', () =>
      expect(mod.joinPath(true, 'bar')).toMatchSnapshot())
  })
})
