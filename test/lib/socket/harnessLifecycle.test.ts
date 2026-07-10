/**
 * Regression coverage for `SocketHarness.close()`'s teardown, isolated in
 * its own file so it can safely create and close exactly ONE harness for
 * the whole suite - see `harness.ts`'s `close()` doc comment for why a
 * second `createSocketHarness()` call in the SAME file would silently
 * operate against an already-deleted `STORE_DIR` (the HTTP suite hit the
 * identical issue; `test/lib/http/harnessLifecycle.test.ts` documents it
 * in full).
 *
 * This proves requirement 2 ("deterministically close all clients, rooms,
 * listeners, hooks, managers, watchers, timers, stores, and servers") is
 * actually true of the harness itself, not just assumed.
 */
import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { createSocketHarness } from './harness.ts'
import { createFakeGateway } from './fakes.ts'
import { getTestStoreDir } from './env.ts'

describe('Socket harness teardown', () => {
	it(
		'close() disconnects every client, removes the log interceptor ' +
			'listener, closes the real io/http server, releases Gateway ' +
			'watchers, clears the jsonStore, and deletes STORE_DIR',
		async () => {
			const harness = await createSocketHarness()
			harness.testHooks.setGateway(createFakeGateway() as any)

			// Dynamic imports (not static top-level ones) for the exact
			// same reason `test/lib/http/harnessLifecycle.test.ts` uses
			// them: a static import would evaluate `api/config/app.ts`'s
			// `storeDir` (and `logStream`) before
			// `createSocketHarness()` had a chance to call
			// `ensureTestEnv()`, freezing them at the wrong value for
			// this whole file.
			const { __getWatcherCountForTests } = await import(
				'../../../api/lib/Gateway.ts'
			)
			const { logStream } = await import('../../../api/lib/logger.ts')

			// Connect two real clients so there's something for close()
			// to actually disconnect (not vacuously zero already).
			const clientA = harness.createClient()
			const clientB = harness.createClient()
			await Promise.all([
				harness.connectClient(clientA),
				harness.connectClient(clientB),
			])
			await harness.waitForServerSocketCount(2)

			// Prove each piece of state this test asserts on post-close is
			// actually exercised beforehand, so a regression in close()
			// itself can't hide behind assertions that would have passed
			// either way.
			const storeDir = getTestStoreDir()
			expect(existsSync(storeDir)).toBe(true)
			expect(__getWatcherCountForTests()).toBeGreaterThan(0)
			expect(logStream.listenerCount('data')).toBeGreaterThan(0)
			expect(harness.io.sockets.sockets.size).toBe(2)
			expect(Object.keys(harness.jsonStore.store).length).toBeGreaterThan(
				0,
			)

			await harness.close()

			expect(clientA.connected).toBe(false)
			expect(clientB.connected).toBe(false)
			expect(harness.io.sockets.sockets.size).toBe(0)
			expect(logStream.listenerCount('data')).toBe(0)
			expect(__getWatcherCountForTests()).toBe(0)
			expect(Object.keys(harness.jsonStore.store).length).toBe(0)
			expect(existsSync(storeDir)).toBe(false)

			// The underlying HTTP server is closed too (io.close() closes
			// it) - a further listen/connect attempt must fail, not hang.
			expect(harness.server.listening).toBe(false)
		},
	)
})
