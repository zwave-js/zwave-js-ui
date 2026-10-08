import {
	describe,
	it,
	expect,
	beforeAll,
	afterAll,
	beforeEach,
	afterEach,
	vi,
} from 'vitest'
import { mkdtemp, rm, readdir, readFile, readlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'
import { Writable } from 'node:stream'
import type ZWaveClient from '../../api/lib/ZwaveClient.ts'
import type DebugManager from '../../api/lib/DebugManager.ts'
import type { ModuleLogger } from '../../api/lib/logger.ts'

// well above the archiver and fs stream buffers, so the zip must stream to finish
const CAPTURE_BYTES = 4 * 1024 * 1024
const CHUNK_BYTES = 64 * 1024

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

	const logLargeCapture = () => {
		// random bytes can't deflate below their own size, so the zip is at least CAPTURE_BYTES
		for (let i = 0; i < CAPTURE_BYTES / CHUNK_BYTES; i++) {
			logger.debug(randomBytes(CHUNK_BYTES).toString('base64'))
		}
	}

	// fds still pointing into the debug temp dir, e.g. `ui-logs-….log (deleted)`
	const openTempFds = async () => {
		const fds = await readdir('/proc/self/fd').catch(() => [])
		const targets = await Promise.all(
			fds.map((fd) => readlink(`/proc/self/fd/${fd}`).catch(() => '')),
		)
		return targets.filter((target) => target.startsWith(debugTempDir()))
	}

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
		vi.restoreAllMocks()
		if (debugManager.isSessionActive()) {
			await debugManager.cancelSession()
		}
	})

	const makeOutput = () =>
		new Writable({
			write(_chunk, _enc, cb) {
				cb()
			},
		})

	it('streams a large capture and removes the temp files', async () => {
		logLargeCapture()
		logger.debug('last line before stop')

		// read the UI log just before it is deleted
		let uiLog = ''
		const originalCleanupTempFiles = (
			debugManager as any
		).cleanupTempFiles.bind(debugManager)
		vi.spyOn(
			debugManager as any,
			'cleanupTempFiles',
		).mockImplementationOnce(
			async (logFilePath: string, driverLogFilePath: string) => {
				uiLog = await readFile(logFilePath, 'utf8')
				return originalCleanupTempFiles(logFilePath, driverLogFilePath)
			},
		)

		let bytesWritten = 0
		const output = new Writable({
			write(chunk, _enc, cb) {
				bytesWritten += chunk.length
				setImmediate(cb)
			},
		})

		// node 1 also adds a node dump entry to the archive
		await debugManager.stopSession([1], output)

		expect(bytesWritten).toBeGreaterThan(CAPTURE_BYTES)
		// the log backlog was flushed before the temp files were removed
		expect(uiLog).toContain('last line before stop')
		expect(debugManager.isSessionActive()).toBe(false)
		expect(await readdir(debugTempDir())).toEqual([])
		expect(await openTempFds()).toEqual([])
	})

	// the fd check reads /proc/self/fd
	it.skipIf(process.platform !== 'linux')(
		'releases the log files when the output fails mid-stream',
		async () => {
			logLargeCapture()

			let chunks = 0
			const output = new Writable({
				write(_chunk, _enc, cb) {
					// fail after some zip bytes have already flowed
					if (++chunks > 3) {
						cb(new Error('client gone'))
					} else {
						setImmediate(cb)
					}
				},
			})

			await expect(debugManager.stopSession([], output)).rejects.toThrow(
				'client gone',
			)
			expect(output.destroyed).toBe(true)
			expect(await readdir(debugTempDir())).toEqual([])
			expect(await openTempFds()).toEqual([])
		},
	)

	it('rejects a concurrent stop of the same session', async () => {
		const [first, second] = await Promise.allSettled([
			debugManager.stopSession([], makeOutput()),
			debugManager.stopSession([], makeOutput()),
		])

		expect(first.status).toBe('fulfilled')
		expect(second).toMatchObject({
			status: 'rejected',
			reason: new Error('No active debug session'),
		})
	})

	it('rejects a new session while the previous one is still stopping', async () => {
		const stopping = debugManager.stopSession([], makeOutput())

		await expect(
			debugManager.startSession(zwaveClient, 'info'),
		).rejects.toThrow('A debug session is still starting or stopping')
		await stopping
	})

	it('consumes the session and its temp files when the restore fails', async () => {
		vi.spyOn(zwaveClient, 'removeExtraLogTransport').mockImplementationOnce(
			() => {
				throw new Error('driver gone')
			},
		)

		await expect(
			debugManager.stopSession([], makeOutput()),
		).rejects.toThrow('driver gone')
		expect(debugManager.isSessionActive()).toBe(false)
		expect(await readdir(debugTempDir())).toEqual([])
		expect(await openTempFds()).toEqual([])
		// a failed restore must not block the next capture
		await debugManager.startSession(zwaveClient, 'info')
	})

	it('still sends the package when the UI log stream failed during capture', async () => {
		const session = (debugManager as any).session
		session.logStream.destroy(new Error('ENOSPC'))

		const chunks: Buffer[] = []
		const output = new Writable({
			write(chunk, _enc, cb) {
				chunks.push(chunk)
				cb()
			},
		})

		await debugManager.stopSession([], output)

		// entry names are stored uncompressed in the zip directory
		expect(Buffer.concat(chunks).includes('ui-logs-')).toBe(true)
		// reported in session-metadata.json
		expect(session.incompleteLogs).toEqual(['ui-logs: ENOSPC'])
		expect(await readdir(debugTempDir())).toEqual([])
	})

	it('adds node dumps, and an error entry for a node that fails to dump', async () => {
		const client = zwaveClient as any
		client.nodes.set(1, { id: 1 })
		vi.spyOn(client, 'getNode').mockImplementation((id) =>
			id === 1 ? {} : undefined,
		)
		vi.spyOn(client, 'dumpNode').mockImplementation((id) => {
			if (id === 2) throw new Error('unknown node')
			return { id }
		})

		const chunks: Buffer[] = []
		const output = new Writable({
			write(chunk, _enc, cb) {
				chunks.push(chunk)
				cb()
			},
		})
		try {
			await debugManager.stopSession([1, 2], output)
		} finally {
			client.nodes.clear()
		}

		const zip = Buffer.concat(chunks)
		for (const entry of [
			'node-1-driver-dump.json',
			'node-1-ui-dump.json',
			'node-2-error.txt',
		]) {
			expect(zip.includes(entry)).toBe(true)
		}
	})

	it('restores the driver log level when the driver is running', async () => {
		const client = zwaveClient as any
		const updateLogConfig = vi.fn()
		client.driverReady = true
		client.driver = { updateLogConfig }
		try {
			await debugManager.stopSession([], makeOutput())
		} finally {
			client.driverReady = false
			delete client.driver
		}

		expect(updateLogConfig).toHaveBeenCalledWith({ level: 'info' })
	})

	it('rejects an overlapping start', async () => {
		await debugManager.cancelSession()

		const [first, second] = await Promise.allSettled([
			debugManager.startSession(zwaveClient, 'info'),
			debugManager.startSession(zwaveClient, 'info'),
		])

		expect(first.status).toBe('fulfilled')
		expect(second).toMatchObject({
			status: 'rejected',
			reason: new Error('A debug session is still starting or stopping'),
		})
	})

	it('removes the temp files when the output fails on the first write', async () => {
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
