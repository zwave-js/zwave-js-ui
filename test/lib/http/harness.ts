import { createServer, type Server as HttpServer } from 'node:http'
import type { Express } from 'express'
import supertest, { type Test as SupertestTest } from 'supertest'
import { vi } from 'vitest'
import type { FakeGateway } from '../shared/fakes.ts'
import type { Driver } from 'zwave-js'
import {
	useHarnessLifecycle,
	listenOnEphemeralPort,
	type GatewayModule,
	type JsonStoreModule,
	type SharedTestContext,
	type StoreConfigModule,
} from '../shared/harness.ts'

type RealGateway = InstanceType<GatewayModule['default']>

type SerialPortsEnumerator = typeof Driver.enumerateSerialPorts
type SerialPortsEnumeratorMock = ReturnType<typeof vi.fn<SerialPortsEnumerator>>

function createSerialPortsEnumeratorMock(): SerialPortsEnumeratorMock {
	return vi.fn(() => Promise.resolve<string[]>([]))
}

export interface HttpHarness {
	app: Express
	request: ReturnType<typeof supertest>
	agent: ReturnType<typeof supertest.agent>
	jsonStore: JsonStoreModule['default']
	store: StoreConfigModule['default']
	server: HttpServer
	loadSnippets(): Promise<void>
	enumerateSerialPorts: SerialPortsEnumeratorMock
}

// Buffers the raw bytes because Superagent's default parser corrupts binary bodies served with a JSON-like content type
export function bufferResponse(req: SupertestTest): SupertestTest {
	return req.buffer(true).parse((response, callback) => {
		const chunks: Buffer[] = []
		response.on('data', (chunk: Buffer) => chunks.push(chunk))
		response.on('end', () => callback(null, Buffer.concat(chunks)))
	})
}

export interface HttpHarnessOptions {
	gateway?: FakeGateway
	restarting?: boolean
	enumerateSerialPorts?: SerialPortsEnumeratorMock
}

async function createHarnessInstance(
	shared: SharedTestContext,
	options: HttpHarnessOptions,
): Promise<HttpHarness & { closeInstance(): Promise<void> }> {
	const enumerateSerialPorts =
		options.enumerateSerialPorts ?? createSerialPortsEnumeratorMock()

	const instance = shared.createApp({
		test: {
			// Gateway has private fields, so a structural mock like FakeGateway needs this cast to satisfy it
			gateway: options.gateway as unknown as RealGateway | undefined,
			restarting: options.restarting,
			enumerateSerialPorts,
		},
	})
	await instance.loadSnippets()

	const server = createServer(instance.app)
	await listenOnEphemeralPort(server)

	return {
		app: instance.app,
		request: supertest(server),
		agent: supertest.agent(server),
		jsonStore: shared.jsonStore,
		store: shared.store,
		server,
		loadSnippets: () => instance.loadSnippets(),
		enumerateSerialPorts,
		async closeInstance() {
			await instance.close()
			await new Promise<void>((resolve, reject) => {
				server.close((err) => (err ? reject(err) : resolve()))
			})
		},
	}
}

// Gives each test a fresh createApp() instance + server, so tests never leak state and need no reset hooks
export function useHttpHarness(): (
	options?: HttpHarnessOptions,
) => Promise<HttpHarness> {
	return useHarnessLifecycle(createHarnessInstance)
}
