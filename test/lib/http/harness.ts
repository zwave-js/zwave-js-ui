import { createServer, type Server as HttpServer } from 'node:http'
import type { Express } from 'express'
import supertest, { type Test as SupertestTest } from 'supertest'
import { vi, afterEach } from 'vitest'
import type { FakeGateway, FakeZniffer } from '../shared/fakes.ts'
import type * as SerialPortsModuleNamespace from '#api/lib/serialPorts'
import {
	useHarnessLifecycle,
	listenOnEphemeralPort,
	type JsonStoreModule,
	type SharedTestContext,
	type StoreConfigModule,
} from '../shared/harness.ts'

type SerialPortsModule = typeof SerialPortsModuleNamespace

// settings.ts imports enumerateSerialPorts as a static module boundary (api/lib/serialPorts.ts) rather
// than accepting it as a constructor-injected collaborator, so it's mocked once here and reset per-test,
// rather than every consuming test file declaring its own vi.mock() of the same module.
const { enumerateSerialPorts } = vi.hoisted(() => ({
	enumerateSerialPorts: vi.fn<SerialPortsModule['enumerateSerialPorts']>(() =>
		Promise.resolve<string[]>([]),
	),
}))

vi.mock('#api/lib/serialPorts', () => ({ enumerateSerialPorts }))

export { enumerateSerialPorts }

export interface HttpHarness {
	app: Express
	request: ReturnType<typeof supertest>
	agent: ReturnType<typeof supertest.agent>
	jsonStore: JsonStoreModule['default']
	store: StoreConfigModule['default']
	server: HttpServer
	loadSnippets(): Promise<void>
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
	zniffer?: FakeZniffer
	restarting?: boolean
}

async function createHarnessInstance(
	shared: SharedTestContext,
	options: HttpHarnessOptions,
): Promise<HttpHarness & { closeInstance(): Promise<void> }> {
	const instance = shared.createApp({
		test: {
			gateway: options.gateway,
			zniffer: options.zniffer,
			restarting: options.restarting,
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
	const getHarness = useHarnessLifecycle(createHarnessInstance)

	afterEach(() => {
		enumerateSerialPorts.mockReset()
		enumerateSerialPorts.mockResolvedValue([])
	})

	return getHarness
}
