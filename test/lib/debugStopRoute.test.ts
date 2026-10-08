import { mkdtemp, rm } from 'node:fs/promises'
import type { Server as HttpServer } from 'node:http'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Writable } from 'node:stream'
import { once } from 'node:events'
import express from 'express'
import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from 'vitest'
import type ZWaveClient from '../../api/lib/ZwaveClient.ts'

// Set before the app config module loads
const testStoreDir = await mkdtemp(join(tmpdir(), 'zui-debug-route-'))
process.env.STORE_DIR = testStoreDir

const { default: jsonStore } = await import('../../api/lib/jsonStore.ts')
const { default: storeConfig } = await import('../../api/config/store.ts')
const { default: app } = await import('../../api/app.ts')
const { default: debugManager } = await import('../../api/lib/DebugManager.ts')
const { logContainer } = await import('../../api/lib/logger.ts')
const appLogger = logContainer.loggers.get('App')

const zwaveClient = {
	driverReady: false,
	nodes: new Map(),
	addExtraLogTransport: () => {},
	removeExtraLogTransport: () => {},
	dumpNode: (nodeId: number) => ({ id: nodeId }),
	getNode: () => undefined,
} as unknown as ZWaveClient

describe('POST /api/debug/stop', () => {
	let server: HttpServer
	let stopUrl: string

	const stop = () =>
		fetch(stopUrl, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ nodeIds: [] }),
		})

	beforeAll(async () => {
		await jsonStore.init(storeConfig)
		server = createServer(app)
		await new Promise<void>((resolve) =>
			server.listen(0, '127.0.0.1', resolve),
		)
		const { port } = server.address() as AddressInfo
		stopUrl = `http://127.0.0.1:${port}/api/debug/stop`
	})

	afterAll(async () => {
		await new Promise((resolve) => server.close(resolve))
		await rm(testStoreDir, { recursive: true, force: true })
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

	it('streams the zip as an attachment', async () => {
		const res = await stop()

		expect(res.headers.get('content-type')).toBe('application/zip')
		expect(res.headers.get('content-disposition')).toMatch(
			/^attachment; filename="zwave-debug-.+\.zip"$/,
		)
		const body = Buffer.from(await res.arrayBuffer())
		expect(body.subarray(0, 2).toString()).toBe('PK')
		// entry names are stored uncompressed in the zip directory
		for (const entry of [
			'ui-logs-',
			'driver-logs-',
			'session-metadata.json',
		]) {
			expect(body.includes(entry)).toBe(true)
		}
		expect(debugManager.isSessionActive()).toBe(false)
	})

	it('answers with JSON and no attachment when stopping fails before streaming', async () => {
		const errorLog = vi.spyOn(appLogger, 'error')
		vi.spyOn(debugManager, 'stopSession').mockRejectedValue(
			new Error('restore failed'),
		)

		const res = await stop()

		expect(res.headers.get('content-disposition')).toBeNull()
		expect(await res.json()).toEqual({
			success: false,
			message: 'restore failed',
		})
		expect(errorLog).toHaveBeenCalledWith(
			'Error stopping debug session, capture discarded:',
			expect.objectContaining({ message: 'restore failed' }),
		)
	})

	it.each([['../x'], [[1.5]], [['1']], [{ 0: 1 }]])(
		'rejects invalid node ids %j without ending the session',
		async (nodeIds) => {
			const res = await fetch(stopUrl, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ nodeIds }),
			})

			expect(await res.json()).toEqual({
				success: false,
				message: 'nodeIds must be an array of integers',
			})
			expect(debugManager.isSessionActive()).toBe(true)
		},
	)

	it('answers with JSON when no session is active', async () => {
		await debugManager.cancelSession()

		const res = await stop()

		expect(res.headers.get('content-disposition')).toBeNull()
		expect(await res.json()).toEqual({
			success: false,
			message: 'No active debug session',
		})
	})

	it('answers nothing when the response is destroyed before any byte', async () => {
		const json = vi.spyOn(express.response, 'json')
		vi.spyOn(debugManager, 'stopSession').mockImplementation(
			(_nodeIds, output) => {
				;(output as Writable).destroy()
				return Promise.reject(new Error('archive failed'))
			},
		)

		// the server destroyed the socket, so the client sees a network error
		await expect(stop()).rejects.toThrow('fetch failed')
		expect(json).not.toHaveBeenCalled()
	})

	it('drops a download that stops making progress', async () => {
		const idleTimeout = app.get('debugDownloadIdleTimeout')
		app.set('debugDownloadIdleTimeout', 50)
		let outputClosed = false
		vi.spyOn(debugManager, 'stopSession').mockImplementation(
			async (_nodeIds, output) => {
				// stands in for an archive stuck on a client that stopped reading
				await once(output as Writable, 'close')
				outputClosed = true
				throw new Error('Debug package download stalled')
			},
		)

		try {
			await expect(stop()).rejects.toThrow('fetch failed')
		} finally {
			app.set('debugDownloadIdleTimeout', idleTimeout)
		}
		// the client can see the dropped socket before the server handles its close
		await vi.waitFor(() => expect(outputClosed).toBe(true))
	})

	it('appends nothing once the zip has started streaming', async () => {
		const json = vi.spyOn(express.response, 'json')
		const warn = vi.spyOn(appLogger, 'warn')
		vi.spyOn(debugManager, 'stopSession').mockImplementation(
			(_nodeIds, output) => {
				const res = output as Writable
				res.write('PK partial')
				// what pipeline() does to the response when the archive fails
				res.destroy()
				return Promise.reject(new Error('archive failed'))
			},
		)

		await expect(stop().then((res) => res.arrayBuffer())).rejects.toThrow(
			/fetch failed|terminated/,
		)
		expect(json).not.toHaveBeenCalled()
		await vi.waitFor(() =>
			expect(warn).toHaveBeenCalledWith(
				'Debug package (capture discarded) not delivered:',
				expect.objectContaining({ message: 'archive failed' }),
			),
		)
	})
})
