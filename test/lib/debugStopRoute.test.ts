import { mkdtemp, rm } from 'node:fs/promises'
import type { Server as HttpServer } from 'node:http'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Writable } from 'node:stream'
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
		vi.spyOn(debugManager, 'stopSession').mockRejectedValue(
			new Error('restore failed'),
		)

		const res = await stop()

		expect(res.headers.get('content-disposition')).toBeNull()
		expect(await res.json()).toEqual({
			success: false,
			message: 'restore failed',
		})
	})

	it('appends nothing once the zip has started streaming', async () => {
		const json = vi.spyOn(express.response, 'json')
		vi.spyOn(debugManager, 'stopSession').mockImplementation(
			(_nodeIds, output) => {
				const res = output as Writable
				res.write('PK partial')
				// what pipeline() does to the response when the archive fails
				res.destroy()
				return Promise.reject(new Error('archive failed'))
			},
		)

		await expect(stop().then((res) => res.arrayBuffer())).rejects.toThrow()
		expect(json).not.toHaveBeenCalled()
	})
})
