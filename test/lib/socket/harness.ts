import { createServer, type Server as HttpServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import type { Express } from 'express'
import type { Server as SocketIOServer } from 'socket.io'
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client'
import type { FakeGateway, FakeZniffer } from './fakes.ts'
import type * as ZnifferModuleNamespace from '#api/lib/ZnifferManager.ts'
import {
	listenOnEphemeralPort,
	useHarnessLifecycle,
	type GatewayModule,
	type SharedTestContext,
} from '../shared/harness.ts'

type ZnifferModule = typeof ZnifferModuleNamespace
type RealGateway = InstanceType<GatewayModule['default']>
type RealZniffer = InstanceType<ZnifferModule['default']>

export interface SocketHarnessOptions {
	gateway?: FakeGateway
	zniffer?: FakeZniffer
	restarting?: boolean
}

export interface SocketHarness {
	app: Express
	io: SocketIOServer
	jsonStore: SharedTestContext['jsonStore']
	store: SharedTestContext['store']
	server: HttpServer
	// Base URL is http://127.0.0.1:<ephemeral port>
	url: string
	// autoConnect defaults false so tests can attach connect_error listeners before connecting; every client is tracked and force-disconnected on teardown
	createClient(opts?: Record<string, unknown>): ClientSocket
	// Connects client and resolves on connect, or rejects on connect_error
	connectClient(client: ClientSocket): Promise<ClientSocket>
	// Round-trips a private per-client event through the real server socket, so a test can await "every already-emitted event this client will receive has arrived" without an arbitrary timer
	flushClientEvents(client: ClientSocket): Promise<void>
	// Polls the real server-side connected-socket count until it matches count
	waitForServerSocketCount(count: number, timeoutMs?: number): Promise<void>
	disconnectAllClients(): Promise<void>
}

async function createHarnessInstance(
	shared: SharedTestContext,
	options: SocketHarnessOptions,
): Promise<SocketHarness & { closeInstance(): Promise<void> }> {
	const instance = shared.createApp({
		test: {
			gateway: options.gateway as unknown as RealGateway | undefined,
			zniffer: options.zniffer as unknown as RealZniffer | undefined,
			restarting: options.restarting,
		},
	})
	await instance.loadSnippets()

	const server = createServer(instance.app)
	instance.attachSocket(server)
	await listenOnEphemeralPort(server)
	const port = (server.address() as AddressInfo).port
	const url = `http://127.0.0.1:${port}`
	const { io } = instance
	const clients = new Set<ClientSocket>()
	let flushSequence = 0

	function createClient(opts: Record<string, unknown> = {}): ClientSocket {
		const client = ioClient(url, {
			path: '/socket.io',
			autoConnect: false,
			reconnection: false,
			transports: ['websocket'],
			...opts,
		})
		clients.add(client)
		return client
	}

	function connectClient(client: ClientSocket): Promise<ClientSocket> {
		return new Promise((resolve, reject) => {
			client.once('connect', () => resolve(client))
			client.once('connect_error', (err: Error) => reject(err))
			client.connect()
		})
	}

	function flushClientEvents(client: ClientSocket): Promise<void> {
		if (!client.id) {
			throw new Error('Cannot flush events for a disconnected client')
		}
		const socket = io.sockets.sockets.get(client.id)
		if (!socket) {
			throw new Error('Connected client has no server socket')
		}
		const event = `__TEST_FLUSH_${flushSequence++}__`
		return new Promise((resolve) => {
			client.once(event, resolve)
			socket.emit(event)
		})
	}

	async function waitForServerSocketCount(
		count: number,
		timeoutMs = 2000,
	): Promise<void> {
		const start = Date.now()
		while (io.sockets.sockets.size !== count) {
			if (Date.now() - start > timeoutMs) {
				throw new Error(
					`Timed out waiting for server socket count to reach ${count} ` +
						`(currently ${io.sockets.sockets.size})`,
				)
			}
			await new Promise((resolve) => setTimeout(resolve, 10))
		}
	}

	async function disconnectAllClients(): Promise<void> {
		for (const client of clients) {
			client.removeAllListeners()
			if (client.connected || client.active) {
				client.disconnect()
			}
		}
		clients.clear()

		try {
			await waitForServerSocketCount(0, 1000)
		} catch {
			// A client may already have completed its disconnect
		}
	}

	return {
		app: instance.app,
		io,
		jsonStore: shared.jsonStore,
		store: shared.store,
		server,
		url,
		createClient,
		connectClient,
		flushClientEvents,
		waitForServerSocketCount,
		disconnectAllClients,
		async closeInstance() {
			await disconnectAllClients()
			await instance.close()
		},
	}
}

// Gives each test a fresh createApp() instance + server, so tests never leak state and need no reset hooks
export function useSocketHarness(): (
	options?: SocketHarnessOptions,
) => Promise<SocketHarness> {
	return useHarnessLifecycle(createHarnessInstance)
}
