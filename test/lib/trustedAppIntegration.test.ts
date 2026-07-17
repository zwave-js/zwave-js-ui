import { mkdtemp, rm } from 'node:fs/promises'
import type { Server as HttpServer } from 'node:http'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { io as ioClient } from 'socket.io-client'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// Set before the app config module loads
const testStoreDir = await mkdtemp(join(tmpdir(), 'zui-trusted-app-'))
process.env.STORE_DIR = testStoreDir

const { default: jsonStore } = await import('../../api/lib/jsonStore.ts')
const { default: storeConfig } = await import('../../api/config/store.ts')
const { default: app, socketManager } = await import('../../api/app.ts')
const { parseCidr } = await import('../../api/lib/ipUtils.ts')
const { startTrustedListener } = await import(
	'../../api/lib/trustedListener.ts'
)

function serverPort(server: HttpServer): number {
	return (server.address() as AddressInfo).port
}

// The history API fallback rewrites GETs that accept */* to the index page,
// so ask for JSON explicitly like the UI does
function getJson(url: string): Promise<any> {
	return fetch(url, { headers: { Accept: 'application/json' } }).then((res) =>
		res.json(),
	)
}

describe('trusted listener app integration', () => {
	let mainServer: HttpServer
	let trustedServer: HttpServer
	let mainUrl: string
	let trustedUrl: string

	beforeAll(async () => {
		await jsonStore.init(storeConfig)
		const settings = jsonStore.get(storeConfig.settings) ?? {}
		await jsonStore.put(storeConfig.settings, {
			...settings,
			gateway: { ...settings.gateway, authEnabled: true },
		})

		mainServer = createServer(app)
		await new Promise<void>((resolve) =>
			mainServer.listen(0, '127.0.0.1', resolve),
		)
		trustedServer = (await startTrustedListener(app, {
			kind: 'tcp',
			host: '127.0.0.1',
			port: 0,
			allowedIps: [parseCidr('127.0.0.0/8')],
		}))!

		mainUrl = `http://127.0.0.1:${serverPort(mainServer)}`
		trustedUrl = `http://127.0.0.1:${serverPort(trustedServer)}`
	})

	afterAll(async () => {
		for (const server of [mainServer, trustedServer]) {
			await new Promise((resolve) => server?.close(resolve))
		}
		await rm(testStoreDir, { recursive: true, force: true })
	})

	it('reports auth as disabled only on the trusted listener', async () => {
		const trusted = await getJson(`${trustedUrl}/api/auth-enabled`)
		expect(trusted).toEqual({ success: true, data: false })

		const untrusted = await getJson(`${mainUrl}/api/auth-enabled`)
		expect(untrusted).toEqual({ success: true, data: true })
	})

	it('bypasses REST authentication only on the trusted listener', async () => {
		const trusted = await getJson(`${trustedUrl}/api/settings`)
		expect(trusted.success).toBe(true)
		expect(trusted.settings).toBeDefined()

		const untrusted = await getJson(`${mainUrl}/api/settings`)
		expect(untrusted).toMatchObject({ success: false, code: 3 })
	})

	it('skips rate limiting only for trusted requests', async () => {
		const authenticate = async (baseUrl: string) => {
			const res = await fetch(`${baseUrl}/api/authenticate`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ username: 'nope', password: 'nope' }),
			})
			return (await res.json()) as { message: string }
		}

		// The login limiter blocks after 5 requests per client
		let untrusted: { message: string }
		for (let i = 0; i < 6; i++) {
			untrusted = await authenticate(mainUrl)
		}
		expect(untrusted.message).toBe('Max requests limit reached')

		// The same (exhausted) client IP must still pass on the trusted listener
		const trusted = await authenticate(trustedUrl)
		expect(trusted.message).not.toBe('Max requests limit reached')
	})

	it('bypasses socket.io authentication only on the trusted listener', async () => {
		socketManager.bindServer(mainServer)
		socketManager.attachServer(trustedServer)

		const connect = (url: string) =>
			new Promise<string>((resolve) => {
				const client = ioClient(url, {
					transports: ['websocket'],
					reconnection: false,
				})
				client.on('connect', () => {
					client.close()
					resolve('connected')
				})
				client.on('connect_error', (err) => {
					client.close()
					resolve(err.message)
				})
			})

		expect(await connect(trustedUrl)).toBe('connected')
		expect(await connect(mainUrl)).toBe('Authentication error')

		await new Promise<void>((resolve) =>
			socketManager.io.close(() => resolve()),
		)
	})
})
