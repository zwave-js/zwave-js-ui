import { Settings } from './Settings'

class LocalStorageMock {
	constructor() {
		this.items = {}
		this.isMocked = true
	}

	getItem(key) {
		return this.items[key]
	}

	setItem(key, val) {
		this.items[key] = val
	}
}

describe('Settings', () => {
	describe('#constructor', () => {
		test('uses the storage passed in as settings store', () => {
			const settings = new Settings(new LocalStorageMock())
			expect(settings.storage.isMocked).toEqual(true)
		})
	})
	describe('#store(non-object)', () => {
		test('should store a non-object', () => {
			const settings = new Settings(new LocalStorageMock())
			settings.store('key', 10)
			expect(settings.storage.items.key).toEqual('10')
		})
	})
	describe('#store(object)', () => {
		test('should store an object', () => {
			const settings = new Settings(new LocalStorageMock())
			settings.store('key', { objkey: 'objval' })
			expect(settings.storage.items.key).toEqual('{"objkey":"objval"}')
		})
	})
	describe('#load(stored boolean)', () => {
		test('should load a stored boolean', () => {
			const settings = new Settings(new LocalStorageMock())
			settings.storage.items.key = 'false'
			expect(settings.load('key', true)).toEqual(false)
		})
	})
	describe('#load(default boolean)', () => {
		test('should load a boolean default value', () => {
			const settings = new Settings(new LocalStorageMock())
			settings.storage.items.key = undefined
			expect(settings.load('key', true)).toEqual(true)
		})
	})
	describe('#load(stored number)', () => {
		test('should load a stored number', () => {
			const settings = new Settings(new LocalStorageMock())
			settings.storage.items.key = '20'
			expect(settings.load('key', 10)).toEqual(20)
		})
	})
	describe('#load(default number)', () => {
		test('should load a number default value', () => {
			const settings = new Settings(new LocalStorageMock())
			settings.storage.items.key = undefined
			expect(settings.load('key', 10)).toEqual(10)
		})
	})
	describe('#load(stored string)', () => {
		test('should load a stored string', () => {
			const settings = new Settings(new LocalStorageMock())
			settings.storage.items.key = 'value'
			expect(settings.load('key', 'default')).toEqual('value')
		})
	})
	describe('#load(default string)', () => {
		test('should load a string default value', () => {
			const settings = new Settings(new LocalStorageMock())
			settings.storage.items.key = undefined
			expect(settings.load('key', 'default')).toEqual('default')
		})
	})
	describe('#load(stored object)', () => {
		test('should load a stored object', () => {
			const settings = new Settings(new LocalStorageMock())
			settings.storage.items.key = '{"objkey":"value"}'
			expect(settings.load('key', { objkey: 'value' })).toEqual({
				objkey: 'value',
			})
		})
	})
	describe('#load(default object)', () => {
		test('should load a object default value', () => {
			const settings = new Settings(new LocalStorageMock())
			settings.storage.items.key = undefined
			expect(settings.load('key', { objkey: 'default' })).toEqual({
				objkey: 'default',
			})
		})
	})
})
