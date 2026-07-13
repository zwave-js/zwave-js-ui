import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { CommandClasses } from '@zwave-js/core'
import { SceneService } from '../../../api/lib/zwave/SceneService.ts'
import type {
	ScenePersistencePort,
	SceneNodeStorePort,
	SceneUtilsPort,
	SceneWritePort,
	ServiceLogger,
	ZUISceneValueRef,
	ZUISceneRecord,
} from '../../../api/lib/zwave/ports.ts'

interface TestValueRef extends ZUISceneValueRef {
	id: string
}

function makeValueId(overrides: Partial<TestValueRef> = {}): TestValueRef {
	return {
		id: `2-${CommandClasses['Binary Switch']}-0-currentValue`,
		nodeId: 2,
		commandClass: CommandClasses['Binary Switch'],
		endpoint: 0,
		property: 'currentValue',
		propertyKey: undefined,
		value: undefined,
		timeout: undefined,
		...overrides,
	}
}

function createPersistencePort() {
	const puts: ZUISceneRecord<TestValueRef>[][] = []
	let stored: ZUISceneRecord<TestValueRef>[] = []
	return {
		get: () => stored,
		// Resolves with the given data, like the real jsonStore-backed port, not a boolean
		put: vi.fn((data: ZUISceneRecord<TestValueRef>[]) => {
			stored = data
			puts.push(data.map((s) => ({ ...s, values: [...s.values] })))
			return Promise.resolve(data)
		}),
		puts,
	} satisfies ScenePersistencePort<TestValueRef> & {
		puts: ZUISceneRecord<TestValueRef>[][]
	}
}

function createNodeStorePort(
	nodes: Record<number, { id: number; values?: Record<string, unknown> }>,
): SceneNodeStorePort {
	return {
		getNode: (nodeId: number) => nodes[nodeId],
	}
}

function createUtilsPort(): SceneUtilsPort {
	return {
		getValueId: (v) =>
			`${v.commandClass}-${v.endpoint ?? 0}-${v.property}${
				v.propertyKey !== undefined && v.propertyKey !== null
					? '-' + v.propertyKey
					: ''
			}`,
	}
}

function createWritePort() {
	const calls: Array<{ valueId: TestValueRef; value: unknown }> = []
	return {
		writeValue: vi.fn((valueId: TestValueRef, value: unknown) => {
			calls.push({ valueId, value })
			return Promise.resolve(true)
		}),
		calls,
	} satisfies SceneWritePort<TestValueRef> & {
		calls: Array<{ valueId: TestValueRef; value: unknown }>
	}
}

function createLogger(): ServiceLogger & { errors: string[] } {
	const errors: string[] = []
	return {
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn((message: string) => {
			errors.push(message)
		}),
		errors,
	}
}

function createService(
	initialScenes: ZUISceneRecord<TestValueRef>[] = [],
	nodes: Record<number, { id: number; values?: Record<string, unknown> }> = {
		2: {
			id: 2,
			values: {
				[`${CommandClasses['Binary Switch']}-0-currentValue`]: {
					value: 0,
				},
			},
		},
	},
) {
	const persistence = createPersistencePort()
	const nodeStore = createNodeStorePort(nodes)
	const utils = createUtilsPort()
	const writer = createWritePort()
	const logger = createLogger()

	const service = new SceneService<TestValueRef>(
		persistence,
		nodeStore,
		utils,
		writer,
		logger,
		initialScenes,
	)

	return { service, persistence, nodeStore, utils, writer, logger }
}

describe('SceneService', () => {
	describe('createScene', () => {
		it('creates the first scene with sceneid 1', async () => {
			const { service, persistence } = createService([])

			const result = await service.createScene('My Scene')

			expect(result).toBe(true)
			expect(service.getScenes()).toEqual([
				{ sceneid: 1, label: 'My Scene', values: [] },
			])
			expect(persistence.put).toHaveBeenCalledTimes(1)
		})

		it('assigns sceneid as last sceneid + 1', async () => {
			const { service } = createService([
				{ sceneid: 5, label: 'Existing', values: [] },
			])

			await service.createScene('Next')

			const scenes = service.getScenes()
			expect(scenes).toHaveLength(2)
			expect(scenes[1].sceneid).toBe(6)
		})
	})

	describe('removeScene', () => {
		it('throws when scene not found', async () => {
			const { service } = createService([])

			await expect(service.removeScene(99)).rejects.toThrow(
				'No scene found with given sceneid',
			)
		})

		it('removes an existing scene and persists', async () => {
			const { service, persistence } = createService([
				{ sceneid: 1, label: 'A', values: [] },
				{ sceneid: 2, label: 'B', values: [] },
			])

			const result = await service.removeScene(1)

			expect(result).toBe(true)
			expect(service.getScenes()).toEqual([
				{ sceneid: 2, label: 'B', values: [] },
			])
			expect(persistence.put).toHaveBeenCalledTimes(1)
		})
	})

	describe('setScenes', () => {
		it('replaces the scenes array and persists', async () => {
			const { service, persistence } = createService([
				{ sceneid: 1, label: 'A', values: [] },
			])

			const newScenes: ZUISceneRecord<TestValueRef>[] = [
				{ sceneid: 10, label: 'Fresh', values: [] },
			]
			const result = await service.setScenes(newScenes)

			expect(result).toEqual(newScenes)
			expect(service.getScenes()).toEqual(newScenes)
			expect(persistence.put).toHaveBeenCalledWith(newScenes)
		})
	})

	describe('sceneGetValues', () => {
		it('throws when scene not found', () => {
			const { service } = createService([])

			expect(() => service.sceneGetValues(1)).toThrow(
				'No scene found with given sceneid',
			)
		})

		it('returns the values array of the given scene', () => {
			const values = [makeValueId()]
			const { service } = createService([
				{ sceneid: 1, label: 'A', values },
			])

			expect(service.sceneGetValues(1)).toEqual(values)
		})
	})

	describe('addSceneValue', () => {
		it('throws when scene not found', async () => {
			const { service } = createService([])

			await expect(
				service.addSceneValue(1, makeValueId(), 1, 0),
			).rejects.toThrow('No scene found with given sceneid')
		})

		it('throws when node not found', async () => {
			const { service } = createService(
				[{ sceneid: 1, label: 'A', values: [] }],
				{},
			)

			await expect(
				service.addSceneValue(1, makeValueId({ nodeId: 99 }), 1, 0),
			).rejects.toThrow('Node 99 not found')
		})

		it('throws when the valueId does not exist on the node', async () => {
			const { service } = createService(
				[{ sceneid: 1, label: 'A', values: [] }],
				{ 2: { id: 2, values: {} } },
			)

			await expect(
				service.addSceneValue(1, makeValueId(), 5, 0),
			).rejects.toThrow('No value found with given valueId')
		})

		it('adds a new value to the scene', async () => {
			const { service, persistence } = createService([
				{ sceneid: 1, label: 'A', values: [] },
			])

			await service.addSceneValue(1, makeValueId(), 42, 3)

			const values = service.sceneGetValues(1)
			expect(values).toHaveLength(1)
			expect(values[0]).toMatchObject({ value: 42, timeout: 3 })
			expect(persistence.put).toHaveBeenCalledTimes(1)
		})

		it('edits the scene value with the same id', async () => {
			const existing = makeValueId({ value: 1, timeout: 1 })
			const { service } = createService([
				{ sceneid: 1, label: 'A', values: [existing] },
			])

			await service.addSceneValue(1, makeValueId(), 99, 7)

			const values = service.sceneGetValues(1)
			expect(values).toHaveLength(1)
			expect(values[0].value).toBe(99)
			expect(values[0].timeout).toBe(7)
		})

		it('defaults timeout to 0 when falsy', async () => {
			const { service } = createService([
				{ sceneid: 1, label: 'A', values: [] },
			])

			await service.addSceneValue(1, makeValueId(), 1, 0)

			expect(service.sceneGetValues(1)[0].timeout).toBe(0)
		})

		it('resolves with the updated scenes collection', async () => {
			const { service } = createService([
				{ sceneid: 1, label: 'A', values: [] },
			])

			const result = await service.addSceneValue(1, makeValueId(), 42, 3)

			expect(result).toEqual([
				{
					sceneid: 1,
					label: 'A',
					values: [
						expect.objectContaining({ value: 42, timeout: 3 }),
					],
				},
			])
		})
	})

	describe('removeSceneValue', () => {
		it('throws when scene not found', async () => {
			const { service } = createService([])

			await expect(
				service.removeSceneValue(1, makeValueId()),
			).rejects.toThrow('No scene found with given sceneid')
		})

		it('throws when the valueId is not part of the scene', async () => {
			const { service } = createService([
				{ sceneid: 1, label: 'A', values: [] },
			])

			await expect(
				service.removeSceneValue(1, makeValueId()),
			).rejects.toThrow('No ValueId match found in given scene')
		})

		it('removes a matching value and persists', async () => {
			const value = makeValueId()
			const { service, persistence } = createService([
				{ sceneid: 1, label: 'A', values: [value] },
			])

			await service.removeSceneValue(1, value)

			expect(service.sceneGetValues(1)).toEqual([])
			expect(persistence.put).toHaveBeenCalledTimes(1)
		})

		it('resolves with the updated scenes collection', async () => {
			const value = makeValueId()
			const { service } = createService([
				{ sceneid: 1, label: 'A', values: [value] },
			])

			const result = await service.removeSceneValue(1, value)

			expect(result).toEqual([{ sceneid: 1, label: 'A', values: [] }])
		})
	})

	describe('activateScene', () => {
		beforeEach(() => {
			vi.useFakeTimers()
		})

		afterEach(() => {
			vi.useRealTimers()
		})

		it('returns true immediately even though writes are scheduled', () => {
			const { service } = createService([
				{ sceneid: 1, label: 'A', values: [makeValueId()] },
			])

			expect(service.activateScene(1)).toBe(true)
		})

		it('writes each value with a zero delay when timeout is unset', async () => {
			const value = makeValueId({ value: 5, timeout: undefined })
			const { service, writer } = createService([
				{ sceneid: 1, label: 'A', values: [value] },
			])

			service.activateScene(1)
			await vi.advanceTimersByTimeAsync(0)

			expect(writer.calls).toEqual([{ valueId: value, value: 5 }])
		})

		it('delays the write by timeout * 1000 ms', async () => {
			const value = makeValueId({ value: 7, timeout: 2 })
			const { service, writer } = createService([
				{ sceneid: 1, label: 'A', values: [value] },
			])

			service.activateScene(1)

			await vi.advanceTimersByTimeAsync(1999)
			expect(writer.calls).toEqual([])

			await vi.advanceTimersByTimeAsync(1)
			expect(writer.calls).toEqual([{ valueId: value, value: 7 }])
		})

		it('schedules every value in the scene independently', async () => {
			const v1 = makeValueId({ id: 'v1', value: 1, timeout: 0 })
			const v2 = makeValueId({ id: 'v2', value: 2, timeout: 1 })
			const { service, writer } = createService([
				{ sceneid: 1, label: 'A', values: [v1, v2] },
			])

			service.activateScene(1)
			await vi.advanceTimersByTimeAsync(0)
			expect(writer.calls).toEqual([{ valueId: v1, value: 1 }])

			await vi.advanceTimersByTimeAsync(1000)
			expect(writer.calls).toEqual([
				{ valueId: v1, value: 1 },
				{ valueId: v2, value: 2 },
			])
		})

		it('logs the error message when writeValue rejects', async () => {
			const value = makeValueId({ value: 1, timeout: 0 })
			const { service, writer, logger } = createService([
				{ sceneid: 1, label: 'A', values: [value] },
			])
			writer.writeValue = vi.fn().mockRejectedValue(new Error('boom'))

			service.activateScene(1)
			await vi.advanceTimersByTimeAsync(0)
			// Flush the rejected-promise microtask queue
			await Promise.resolve()
			await Promise.resolve()

			expect(logger.errors).toContain('boom')
		})
	})
})
