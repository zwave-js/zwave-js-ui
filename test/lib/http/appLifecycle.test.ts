import { describe, it, expect, vi } from 'vitest'
import { loadAppModule } from '../shared/harness.ts'

describe('AppInstance: fatal-error labeling', () => {
	it('labels each installed fatal-event handler from the event that fired', async () => {
		const { createApp } = await loadAppModule()
		const logFatalError = vi.fn()
		const beforeUncaught = new Set(process.listeners('uncaughtException'))
		const beforeRejection = new Set(process.listeners('unhandledRejection'))
		const instance = createApp({ test: { logFatalError } })

		instance.installProcessHandlers()
		const uncaught = process
			.listeners('uncaughtException')
			.find((listener) => !beforeUncaught.has(listener))
		const rejection = process
			.listeners('unhandledRejection')
			.find((listener) => !beforeRejection.has(listener))

		expect(uncaught).toBeDefined()
		expect(rejection).toBeDefined()
		uncaught?.(new Error('uncaught'), 'uncaughtException')
		rejection?.('rejected', Promise.resolve())

		expect(logFatalError.mock.calls[0][0]).toMatch(
			/^Uncaught Exception, reason: uncaught/,
		)
		expect(logFatalError.mock.calls[1][0]).toBe(
			"Unhandled Rejection, reason: 'rejected'",
		)

		await instance.close()
	})
})

describe('AppInstance: installProcessHandlers()/close() own only this instance', () => {
	const EVENTS = [
		'uncaughtException',
		'unhandledRejection',
		'SIGINT',
		'SIGTERM',
	] as const

	function snapshotListenerCounts(): Record<(typeof EVENTS)[number], number> {
		return Object.fromEntries(
			EVENTS.map((event) => [event, process.listenerCount(event)]),
		) as Record<(typeof EVENTS)[number], number>
	}

	it('registers exactly one listener per event, and repeated installs do not stack duplicates', async () => {
		const { createApp } = await loadAppModule()
		const instance = createApp()
		const before = snapshotListenerCounts()

		instance.installProcessHandlers()
		instance.installProcessHandlers()
		instance.installProcessHandlers()

		const afterInstall = snapshotListenerCounts()
		for (const event of EVENTS) {
			expect(afterInstall[event]).toBe(before[event] + 1)
		}

		await instance.close()

		expect(snapshotListenerCounts()).toEqual(before)
	})

	it('preserves a foreign listener registered before install, and leaves it in place after close()', async () => {
		const { createApp } = await loadAppModule()
		const foreignListener = () => {}
		process.on('SIGINT', foreignListener)

		try {
			const before = snapshotListenerCounts()
			const instance = createApp()
			instance.installProcessHandlers()

			expect(process.listenerCount('SIGINT')).toBe(before.SIGINT + 1)
			expect(process.listeners('SIGINT')).toContain(foreignListener)

			await instance.close()

			expect(process.listenerCount('SIGINT')).toBe(before.SIGINT)
			expect(process.listeners('SIGINT')).toContain(foreignListener)
		} finally {
			process.removeListener('SIGINT', foreignListener)
		}
	})

	it('keeps separate listeners for independent instances', async () => {
		const { createApp } = await loadAppModule()
		const a = createApp()
		const b = createApp()
		const before = snapshotListenerCounts()

		a.installProcessHandlers()
		b.installProcessHandlers()
		const afterBothInstalled = snapshotListenerCounts()
		for (const event of EVENTS) {
			expect(afterBothInstalled[event]).toBe(before[event] + 2)
		}

		await a.close()
		const afterAClosed = snapshotListenerCounts()
		for (const event of EVENTS) {
			expect(afterAClosed[event]).toBe(before[event] + 1)
		}

		await b.close()
		expect(snapshotListenerCounts()).toEqual(before)
	})

	it('close() is idempotent and safe to call more than once', async () => {
		const { createApp } = await loadAppModule()
		const instance = createApp()
		const before = snapshotListenerCounts()
		instance.installProcessHandlers()

		await instance.close()
		await instance.close()

		expect(snapshotListenerCounts()).toEqual(before)
	})

	it('closes safely without installed process handlers', async () => {
		const { createApp } = await loadAppModule()
		const instance = createApp()
		const before = snapshotListenerCounts()

		await expect(instance.close()).resolves.toBeUndefined()
		expect(snapshotListenerCounts()).toEqual(before)
	})
})
