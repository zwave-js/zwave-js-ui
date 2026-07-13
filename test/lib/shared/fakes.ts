// Base zwave/mqtt/gateway fakes shared by both the HTTP and socket suites. Neither is HTTP- or
// socket-specific; each transport layers its own transport-only members on top (see socket/fakes.ts).
import { vi } from 'vitest'

export interface FakeZwaveClient {
	devices: Record<string, unknown>
	homeHex: string
	driverReady: boolean
	driver: {
		updateOptions: ReturnType<typeof vi.fn>
		updateLogConfig: ReturnType<typeof vi.fn>
	}
	getStatus: ReturnType<typeof vi.fn>
	getState: ReturnType<typeof vi.fn>
	callApi: ReturnType<typeof vi.fn>
	storeDevices: ReturnType<typeof vi.fn>
	updateDevice: ReturnType<typeof vi.fn>
	addDevice: ReturnType<typeof vi.fn>
	getConfigurationTemplates: ReturnType<typeof vi.fn>
	createConfigurationTemplate: ReturnType<typeof vi.fn>
	importConfigurationTemplates: ReturnType<typeof vi.fn>
	getDeviceConfigurationParams: ReturnType<typeof vi.fn>
	updateConfigurationTemplate: ReturnType<typeof vi.fn>
	deleteConfigurationTemplate: ReturnType<typeof vi.fn>
	applyConfigurationTemplate: ReturnType<typeof vi.fn>
	enableStatistics: ReturnType<typeof vi.fn>
	disableStatistics: ReturnType<typeof vi.fn>
	cacheSnippets: unknown[]
	addExtraLogTransport: ReturnType<typeof vi.fn>
	removeExtraLogTransport: ReturnType<typeof vi.fn>
	dumpNode: ReturnType<typeof vi.fn>
	getNode: ReturnType<typeof vi.fn>
	nodes: { get: ReturnType<typeof vi.fn> }
	restart: ReturnType<typeof vi.fn>
}

export function createFakeZwaveClient(
	overrides: Partial<FakeZwaveClient> = {},
): FakeZwaveClient {
	return {
		devices: { 2: { name: 'Fake device' } },
		homeHex: '0xdeadbeef',
		driverReady: true,
		driver: { updateOptions: vi.fn(), updateLogConfig: vi.fn() },
		getStatus: vi.fn(() => ({
			driverReady: true,
			status: true,
			config: {},
		})),
		getState: vi.fn(() => ({ nodes: [], info: {}, error: null })),
		callApi: vi.fn(() => Promise.resolve({ success: true, message: 'OK' })),
		storeDevices: vi.fn(() => Promise.resolve(undefined)),
		updateDevice: vi.fn(() => undefined),
		addDevice: vi.fn(() => undefined),
		getConfigurationTemplates: vi.fn(() => []),
		createConfigurationTemplate: vi.fn(() =>
			Promise.resolve({ id: 'template-1' }),
		),
		importConfigurationTemplates: vi.fn(() =>
			Promise.resolve({
				imported: 0,
				skipped: 0,
			}),
		),
		getDeviceConfigurationParams: vi.fn(() => Promise.resolve([])),
		updateConfigurationTemplate: vi.fn(() =>
			Promise.resolve({ id: 'template-1' }),
		),
		deleteConfigurationTemplate: vi.fn(() => Promise.resolve(undefined)),
		applyConfigurationTemplate: vi.fn(() =>
			Promise.resolve({
				success: 1,
				failed: 0,
			}),
		),
		enableStatistics: vi.fn(),
		disableStatistics: vi.fn(),
		cacheSnippets: [],
		addExtraLogTransport: vi.fn(),
		removeExtraLogTransport: vi.fn(),
		dumpNode: vi.fn(() => ({})),
		getNode: vi.fn(() => undefined),
		nodes: { get: vi.fn(() => undefined) },
		restart: vi.fn(() => Promise.resolve(undefined)),
		...overrides,
	}
}

export interface FakeMqttClient {
	getStatus: ReturnType<typeof vi.fn>
}

export function createFakeMqttClient(
	overrides: Partial<FakeMqttClient> = {},
): FakeMqttClient {
	return {
		getStatus: vi.fn(() => ({
			status: true,
			error: 'Offline',
			config: { disabled: false },
		})),
		...overrides,
	}
}

export interface FakeGateway {
	zwave?: FakeZwaveClient
	mqtt?: FakeMqttClient
	close: ReturnType<typeof vi.fn>
	start: ReturnType<typeof vi.fn>
	updateNodeTopics: ReturnType<typeof vi.fn>
	removeNodeRetained: ReturnType<typeof vi.fn>
	publishDiscovery: ReturnType<typeof vi.fn>
	rediscoverNode: ReturnType<typeof vi.fn>
	disableDiscovery: ReturnType<typeof vi.fn>
}

export function createFakeGateway(
	overrides: Partial<FakeGateway> = {},
): FakeGateway {
	return {
		zwave: createFakeZwaveClient(),
		mqtt: createFakeMqttClient(),
		close: vi.fn(() => Promise.resolve(undefined)),
		start: vi.fn(() => Promise.resolve(undefined)),
		updateNodeTopics: vi.fn(),
		removeNodeRetained: vi.fn(),
		publishDiscovery: vi.fn(),
		rediscoverNode: vi.fn(),
		disableDiscovery: vi.fn(),
		...overrides,
	}
}
