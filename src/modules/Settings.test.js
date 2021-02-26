import chai from 'chai'
import { Settings } from './Settings'

class LocalStorageMock {
  constructor () {
    this.items = {}
    this.isMocked = true
  }

  getItem (key) {
    return this.items[key]
  }

  setItem (key, val) {
    this.items[key] = val
  }
}

describe('Settings', () => {
  describe('#constructor', () => {
    test('uses the storage passed in as settings store', () => {
      const settings = new Settings(new LocalStorageMock())
      chai.expect(settings.storage.isMocked).to.eql(true)
    })
  })
  describe('#store(non-object)', () => {
    test('should store a non-object', () => {
      const settings = new Settings(new LocalStorageMock())
      settings.store('key', 10)
      chai.expect(settings.storage.items.key).to.eql('10')
    })
  })
  describe('#store(object)', () => {
    test('should store an object', () => {
      const settings = new Settings(new LocalStorageMock())
      settings.store('key', { objkey: 'objval' })
      chai.expect(settings.storage.items.key).to.eql('{"objkey":"objval"}')
    })
  })
  describe('#load(stored boolean)', () => {
    test('should load a stored boolean', () => {
      const settings = new Settings(new LocalStorageMock())
      settings.storage.items.key = 'false'
      chai.expect(settings.load('key', true)).to.eql(false)
    })
  })
  describe('#load(default boolean)', () => {
    test('should load a boolean default value', () => {
      const settings = new Settings(new LocalStorageMock())
      settings.storage.items.key = undefined
      chai.expect(settings.load('key', true)).to.eql(true)
    })
  })
  describe('#load(stored number)', () => {
    test('should load a stored number', () => {
      const settings = new Settings(new LocalStorageMock())
      settings.storage.items.key = '20'
      chai.expect(settings.load('key', 10)).to.eql(20)
    })
  })
  describe('#load(default number)', () => {
    test('should load a number default value', () => {
      const settings = new Settings(new LocalStorageMock())
      settings.storage.items.key = undefined
      chai.expect(settings.load('key', 10)).to.eql(10)
    })
  })
  describe('#load(stored string)', () => {
    test('should load a stored string', () => {
      const settings = new Settings(new LocalStorageMock())
      settings.storage.items.key = 'value'
      chai.expect(settings.load('key', 'default')).to.eql('value')
    })
  })
  describe('#load(default string)', () => {
    test('should load a string default value', () => {
      const settings = new Settings(new LocalStorageMock())
      settings.storage.items.key = undefined
      chai.expect(settings.load('key', 'default')).to.eql('default')
    })
  })
  describe('#load(stored object)', () => {
    test('should load a stored object', () => {
      const settings = new Settings(new LocalStorageMock())
      settings.storage.items.key = '{"objkey":"value"}'
      chai
        .expect(settings.load('key', { objkey: 'value' }))
        .to.eql({ objkey: 'value' })
    })
  })
  describe('#load(default object)', () => {
    test('should load a object default value', () => {
      const settings = new Settings(new LocalStorageMock())
      settings.storage.items.key = undefined
      chai
        .expect(settings.load('key', { objkey: 'default' }))
        .to.eql({ objkey: 'default' })
    })
  })
})
