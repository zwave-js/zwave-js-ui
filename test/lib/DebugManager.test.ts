import {
	describe,
	it,
	expect,
	beforeAll,
	afterAll,
	beforeEach,
	afterEach,
} from 'vitest'
import { mkdtemp, rm, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'
import { Writable } from 'node:stream'
import type ZWaveClient from '../../api/lib/ZwaveClient.ts'
import type DebugManager from '../../api/lib/DebugManager.ts'
import type { ModuleLogger } from '../../api/lib/logger.ts'

describe('DebugManager', () => {
	let storeDir: string
	let debugManager: typeof DebugManager
	let logger: ModuleLogger

	const zwaveClient = {
		driverReady: false,
		nodes: new Map(),
		addExtraLogTransport: () => {},
		removeExtraLogTransport: () => {},
		dumpNode: (nodeId: number) => ({ id: nodeId }),
		getNode: () => undefined,
	} as unknown as ZWaveClient

	const debugTempDir = () => join(storeDir, '.debug-temp')

	beforeAll(async () => {
		storeDir = await mkdtemp(join(tmpdir(), 'zui-debug-'))
		process.env.STORE_DIR = storeDir
		debugManager = (await import('../../api/lib/DebugManager.ts')).default
		logger = (await import('../../api/lib/logger.ts')).module('DebugTest')
	})

	afterAll(async () => {
		delete process.env.STORE_DIR
		await rm(storeDir, { recursive: true, force: true })
	})

	beforeEach(async () => {
		await debugManager.startSession(zwaveClient, 'info')
	})

	afterEach(async () => {
		if (debugManager.isSessionActive()) {
			await debugManager.cancelSession()
		}
	})

	it('streams a large capture and removes the temp files', async () => {
		// larger than the archiver and log stream buffers
		for (let i = 0; i < 64; i++) {
			logger.debug(randomBytes(64 * 1024).toString('base64'))
		}

		let bytes = 0
		const output = new Writable({
			write(chunk, _enc, cb) {
				bytes += chunk.length
				setImmediate(cb)
			},
		})

		await debugManager.stopSession([1], output)

		expect(bytes).toBeGreaterThan(4 * 1024 * 1024)
		expect(debugManager.isSessionActive()).toBe(false)
		expect(await readdir(debugTempDir())).toEqual([])
	})

	it('removes the temp files when the output fails', async () => {
		const output = new Writable({
			write(_chunk, _enc, cb) {
				cb(new Error('client gone'))
			},
		})

		await expect(debugManager.stopSession([], output)).rejects.toThrow(
			'client gone',
		)
		expect(await readdir(debugTempDir())).toEqual([])
	})
})
