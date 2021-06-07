const mod = require('../../lib/Constants')

describe('#Constants', () => {
  describe('#productionType()', () => {
    let map
    beforeAll(() => {
      map = mod._productionMap
      mod._productionMap = { 1: 'foo' }
    })
    afterAll(() => {
      mod._productionMap = map
    })
    test('known', () =>
      expect(mod.productionType(1)).toEqual({
        objectId: 'foo',
        props: { device_class: 'power' },
        sensor: 'energy_production'
      }))

    test('unknown', () =>
      expect(mod.productionType(2)).toEqual({
        objectId: 'unknown',
        props: { device_class: 'power' },
        sensor: 'energy_production'
      }))
    test('timestamp', () =>
      expect(mod.productionType(3)).toEqual({
        objectId: 'unknown',
        props: { device_class: 'timestamp' },
        sensor: 'energy_production'
      }))
  })
  describe('#alarmType()', () => {
    let map
    beforeAll(() => {
      map = mod._alarmMap
      mod._alarmMap = { 1: 'foo' }
    })
    afterAll(() => {
      mod._alarmMap = map
    })
    test('known', () => expect(mod.alarmType(1)).toEqual('foo'))
    test('unknown', () => expect(mod.alarmType(3)).toEqual('unknown_3'))
  })
  describe('#sensorType()', () => {
    let map
    beforeAll(() => {
      map = mod._sensorMap
      mod._sensorMap = {
        foo: { 1: 'bar', props: { a: 'b', c: 'd' } },
        bar: { 2: 'foo' }
      }
    })
    afterAll(() => {
      mod._sensorMap = map
    })
    test('known', () =>
      expect(mod.sensorType(1)).toEqual({
        sensor: 'foo',
        objectId: 'bar',
        props: { a: 'b', c: 'd' }
      }))
    test('no props', () =>
      expect(mod.sensorType(2)).toEqual({
        sensor: 'bar',
        objectId: 'foo',
        props: {}
      }))
    test('unknown', () =>
      expect(mod.sensorType(3)).toEqual({
        sensor: 'generic',
        objectId: 'unknown_3',
        props: {}
      }))
  })
  describe('#commandClass()', () => {
    let map
    beforeAll(() => {
      map = mod._commandClassMap
      mod._commandClassMap = { 1: 'foo' }
    })
    afterAll(() => {
      mod._commandClassMap = map
    })
    test('known', () => expect(mod.commandClass(1)).toEqual('foo'))
    test('unknown', () => expect(mod.commandClass(3)).toEqual('unknownClass_3'))
  })
  describe('#genericDeviceClass()', () => {
    let map
    beforeAll(() => {
      map = mod._genericDeviceClassMap
      mod._genericDeviceClassMap = {
        1: { generic: 'foo', specific: { 1: 'bar', 2: 'baz' } }
      }
    })
    afterAll(() => {
      mod._genericDeviceClassMap = map
    })
    test('known generic type', () =>
      expect(mod.genericDeviceClass(1)).toEqual('foo'))
    test('unknown generic type', () =>
      expect(mod.genericDeviceClass(3)).toEqual('unknownGenericDeviceType_3'))
  })
  describe('#specificDeviceClass()', () => {
    let map
    beforeAll(() => {
      map = mod._genericDeviceClassMap
      mod._genericDeviceClassMap = {
        1: { generic: 'foo', specific: { 1: 'bar', 2: 'baz' } }
      }
    })
    afterAll(() => {
      mod._genericDeviceClassMap = map
    })
    test('known specific type', () =>
      expect(mod.specificDeviceClass(1, 1)).toEqual('bar'))
    test('unknown specific type', () =>
      expect(mod.specificDeviceClass(1, 3)).toEqual('unknownSpecificDeviceType_3'))
    test('unknown generic type 1', () =>
      expect(mod.specificDeviceClass(2, 1)).toEqual('unknownGenericDeviceType_2'))
    test('unknown generic type 2', () =>
      expect(mod.specificDeviceClass(2, 3)).toEqual('unknownGenericDeviceType_2'))
  })
})
