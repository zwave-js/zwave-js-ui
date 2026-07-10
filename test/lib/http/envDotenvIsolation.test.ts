import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createHttpHarness, type HttpHarness } from './harness.ts'

/**
 * Regression for `test/lib/http/env.ts`'s `dotenv`-repopulation fix.
 *
 * `api/config/app.ts` calls `dotenv`'s `config({ path: './.env.app' })` at
 * module-evaluation time - i.e. relative to `process.cwd()` at that moment.
 * Before the fix, `ensureTestEnv()`'s normalization (`delete
 * process.env[key]`) left every `APP_ENV_VARS` entry genuinely *absent*,
 * which is exactly the state `dotenv`'s default `override: false` behavior
 * will repopulate from a file (it only skips a key that is already
 * *present*, even as an empty string). So a real `.env.app` file - a
 * developer's local override, a future CI convenience file, ... - could
 * silently repopulate the very values normalization just removed.
 *
 * This test proves none of a hostile `.env.app`'s values can reach the app
 * under test, WITHOUT ever touching the real repo's `.env.app` (there
 * isn't one checked in, but a developer or CI runner could have one) and
 * WITHOUT racing any other test file: `vitest`'s default `forks` pool runs
 * each test file in its own OS process (verified empirically - two
 * concurrently-run scratch test files log distinct `process.pid`s), so
 * `process.chdir()` scoped to this file's `beforeAll`/`afterAll` only ever
 * affects this process's view of the filesystem for the duration of this
 * suite, is restored before this file's tests finish, and can't collide
 * with another test file's own `dotenv.config({ path: './.env.app' })`
 * resolution running in a sibling process against the real repo root. An
 * earlier version of this test instead wrote directly to
 * `<repoRoot>/.env.app` (restoring/backing up any pre-existing file) - that
 * poisoned the *real* repo root for the whole duration of the write,
 * which every other concurrently-running test file resolves
 * `./.env.app` against too, and caused unrelated suites
 * (`test/lib/Constants.test.ts`, `test/lib/Gateway.test.ts`, ...) to fail
 * with `EACCES`/`ENOENT` from the hostile `STORE_DIR`. Chdir-ing into a
 * private temp directory avoids that class of bug entirely.
 *
 * Reverting `env.ts`'s `vi.mock('dotenv', ...)` makes this suite fail: the
 * hostile file's `STORE_DIR`/`TZ`/`LOCALE`/`TAG_NAME`/`ZWAVE_PORT` values
 * leak into the running app exactly as this file predicts.
 */
const HOSTILE_ENV_APP_CONTENTS = [
	'HOST=203.0.113.9',
	'PORT=1',
	'STORE_DIR=/nonexistent/from-dotenv-file',
	'ZWAVE_PORT=/dev/ttyFROMDOTENV',
	'HTTPS=true',
	'USE_SECURE_COOKIE=true',
	'TZ=Dotenv/Zone',
	'LOCALE=xx-XX',
	'FORCE_DISABLE_SSL=true',
	'TAG_NAME=zwavejs2mqtt',
	'DEFAULT_USERNAME=dotenv-admin',
	'DEFAULT_PASSWORD=dotenv-password',
	'BASE_PATH=/dotenv',
	'',
].join('\n')

let originalCwd: string
let tmpDir: string

describe('HTTP contract: a real .env.app file cannot repopulate normalized env vars', () => {
	let harness: HttpHarness

	beforeAll(async () => {
		originalCwd = process.cwd()
		tmpDir = mkdtempSync(
			path.join(tmpdir(), 'zwave-js-ui-dotenv-isolation-'),
		)
		writeFileSync(path.join(tmpDir, '.env.app'), HOSTILE_ENV_APP_CONTENTS)
		process.chdir(tmpDir)

		harness = await createHttpHarness()
	})

	afterAll(async () => {
		await harness.close()
		process.chdir(originalCwd)
		rmSync(tmpDir, { recursive: true, force: true })
	})

	it('normalizes STORE_DIR to the harness-owned directory, not the hostile file value', () => {
		expect(process.env.STORE_DIR).toBeDefined()
		expect(process.env.STORE_DIR).not.toBe('/nonexistent/from-dotenv-file')
		expect(process.env.STORE_DIR).toContain('zwave-js-ui-http-contract-')
	})

	it('ignores the hostile FORCE_DISABLE_SSL/HTTPS values: sslDisabled reports false', async () => {
		const res = await harness.request.get('/api/settings')
		expect(res.status).toBe(200)
		expect(res.body.sslDisabled).toBe(false)
	})

	it('ignores the hostile TZ/LOCALE values: settings echoes undefined for both, not the file values', async () => {
		const res = await harness.request.get('/api/settings')
		expect(res.status).toBe(200)
		expect(res.body.tz).toBeUndefined()
		expect(res.body.locale).toBeUndefined()
	})

	it('ignores the hostile TAG_NAME value: deprecationWarning is false, not true', async () => {
		const res = await harness.request.get('/api/settings')
		expect(res.status).toBe(200)
		expect(res.body.deprecationWarning).toBe(false)
	})

	it('ignores the hostile ZWAVE_PORT value: serial-ports still calls the (mocked) enumerator instead of skipping it', async () => {
		let called = false
		harness.testHooks.setEnumerateSerialPorts(() => {
			called = true
			return Promise.resolve(['/dev/ttyISOLATED'])
		})

		const res = await harness.request.get('/api/serial-ports')

		expect(called).toBe(true)
		expect(res.status).toBe(200)
		expect(res.body).toEqual({
			success: true,
			serial_ports: ['/dev/ttyISOLATED'],
		})
	})
})
