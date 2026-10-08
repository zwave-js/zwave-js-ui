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
import { mkdtemp, rm, readdir, readlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'
import { inflateRawSync } from 'node:zlib'
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
		// the base64 text carries CAPTURE_BYTES of entropy, so no deflate gets the zip below that
		for (let i = 0; i < CAPTURE_BYTES / CHUNK_BYTES; i++) {
			logger.debug(randomBytes(CHUNK_BYTES).toString('base64'))
		}
	}

	// no fd may still point into the debug temp dir, e.g. `ui-logs-….log (deleted)`
	const expectNoOpenTempFds = async () => {
		// fds are only listable through /proc: the check is Linux only (CI runs there)
		if (process.platform !== 'linux') return
		const fds = await readdir('/proc/self/fd')
		const targets = await Promise.all(
			fds.map((fd) => readlink(`/proc/self/fd/${fd}`).catch(() => '')),
		)
		expect(
			targets.filter((target) => target.startsWith(debugTempDir())),
		).toEqual([])
	}

	const collectOutput = () => {
		const chunks: Buffer[] = []
		const output = new Writable({
			write(chunk, _enc, cb) {
				chunks.push(chunk)
				cb()
			},
		})
		return { output, zip: () => Buffer.concat(chunks) }
	}

	// deflated entry from its zip local file header; names are stored uncompressed
	const LOCAL_HEADER_SIZE = 30
	const EXTRA_LENGTH_OFFSET = 28
	const readZipEntry = (zip: Buffer, name: string) => {
		const nameStart = zip.indexOf(name)
		const headerStart = nameStart - LOCAL_HEADER_SIZE
		const extraLength = zip.readUInt16LE(headerStart + EXTRA_LENGTH_OFFSET)
		return inflateRawSync(
			zip.subarray(nameStart + name.length + extraLength),
		).toString()
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

		const uiLogName = `ui-logs-${(debugManager as any).session.startTime.toISOString()}.log`

		const chunks: Buffer[] = []
		const output = new Writable({
			write(chunk, _enc, cb) {
				chunks.push(chunk)
				// a slow consumer, so the zip has to stream rather than buffer
				setImmediate(cb)
			},
		})

		// node 1 also adds a node dump entry to the archive
		await debugManager.stopSession([1], output)

		const zip = Buffer.concat(chunks)
		expect(zip.length).toBeGreaterThan(CAPTURE_BYTES)
		// the log backlog was flushed before the transport was detached
		expect(readZipEntry(zip, uiLogName)).toContain('last line before stop')
		expect(debugManager.isSessionActive()).toBe(false)
		expect(await readdir(debugTempDir())).toEqual([])
		await expectNoOpenTempFds()
	})

	it('releases the log files when the output fails mid-stream', async () => {
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
		await expectNoOpenTempFds()
	})

	it('releases the log files when the output is closed mid-stream', async () => {
		logLargeCapture()

		let chunks = 0
		const output = new Writable({
			write(_chunk, _enc, cb) {
				// a stalled client dropped by the idle timeout: closed without an error
				if (++chunks > 3) {
					output.destroy()
				}
				setImmediate(cb)
			},
		})

		await expect(debugManager.stopSession([], output)).rejects.toThrow(
			'Premature close',
		)
		expect(await readdir(debugTempDir())).toEqual([])
		await expectNoOpenTempFds()
	})

	it('rejects a cancel while the session is being stopped', async () => {
		const stopping = debugManager.stopSession([], makeOutput())

		await expect(debugManager.cancelSession()).rejects.toThrow(
			'No active debug session',
		)
		await stopping
		expect(await readdir(debugTempDir())).toEqual([])
	})

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

	it('still sends the package when the driver log level cannot be restored', async () => {
		vi.spyOn(zwaveClient, 'removeExtraLogTransport').mockImplementationOnce(
			() => {
				throw new Error('driver gone')
			},
		)
		const { output, zip } = collectOutput()

		await debugManager.stopSession([], output)

		expect(zip().includes('ui-logs-')).toBe(true)
		expect(
			JSON.parse(readZipEntry(zip(), 'session-metadata.json')),
		).toMatchObject({ restoreError: 'driver gone' })
		expect(debugManager.isSessionActive()).toBe(false)
		expect(await readdir(debugTempDir())).toEqual([])
		await expectNoOpenTempFds()
		// a failed restore must not block the next capture
		await debugManager.startSession(zwaveClient, 'info')
	})

	it('still sends the package when a capture stream failed', async () => {
		const session = (debugManager as any).session
		session.logStream.destroy(new Error('ENOSPC'))
		session.driverLogStream.destroy(new Error('EIO'))

		const { output, zip } = collectOutput()

		await debugManager.stopSession([], output)

		expect(zip().includes('ui-logs-')).toBe(true)
		expect(
			JSON.parse(readZipEntry(zip(), 'session-metadata.json')),
		).toMatchObject({
			incompleteLogs: [
				{ file: 'ui-logs', error: 'ENOSPC' },
				{ file: 'driver-logs', error: 'EIO' },
			],
		})
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

		const { output, zip } = collectOutput()
		try {
			await debugManager.stopSession([1, 2], output)
		} finally {
			client.nodes.clear()
		}

		for (const entry of [
			'node-1-driver-dump.json',
			'node-1-ui-dump.json',
			'node-2-error.txt',
		]) {
			expect(zip().includes(entry)).toBe(true)
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

	it('reports a failed restore on cancel and still cleans up', async () => {
		vi.spyOn(zwaveClient, 'removeExtraLogTransport').mockImplementationOnce(
			() => {
				throw new Error('driver gone')
			},
		)

		await expect(debugManager.cancelSession()).rejects.toThrow(
			'Could not restore the driver log level: driver gone',
		)
		expect(debugManager.isSessionActive()).toBe(false)
		expect(await readdir(debugTempDir())).toEqual([])
		await expectNoOpenTempFds()
	})

	it('fails instead of hanging when a log file cannot be read', async () => {
		const session = (debugManager as any).session
		const uiLogPath = session.logFilePath
		// a directory passes the exists check but fails to read with EISDIR
		session.logFilePath = debugTempDir()

		try {
			await expect(
				debugManager.stopSession([], makeOutput()),
			).rejects.toThrow(/EISDIR/)
			expect(debugManager.isSessionActive()).toBe(false)
		} finally {
			await rm(uiLogPath, { force: true })
		}
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
