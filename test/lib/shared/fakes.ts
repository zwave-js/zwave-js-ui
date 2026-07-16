// Base zwave/mqtt/gateway fakes shared by both the HTTP and socket suites. Neither is HTTP- or
// socket-specific; each transport layers its own transport-only members on top (see socket/fakes.ts).
import { vi } from 'vitest'
import type { Mock } from 'vitest'
import type {
	GatewayPort,
	MqttClientPort,
	ZnifferPort,
	ZwaveClientPort,
} from '#api/runtime/ports.ts'
import type { StoreHassDevicesResult } from '#api/hass/types.ts'
import type { MqttDiscoveryManagerOptions } from '#api/hass/MqttDiscoveryManager.ts'
import { CustomDeviceRegistry } from '#api/hass/CustomDeviceRegistry.ts'
import { tmpdir } from 'node:os'
import path from 'node:path'

export interface FakeZwaveClient extends ZwaveClientPort {
	devices: ZwaveClientPort['devices']
	homeHex: string
	driverReady: boolean
	driver: {
		updateOptions: Mock
		updateLogConfig: Mock
	}
	getStatus: Mock
	getState: Mock
	callApi: Mock
	storeDevices: Mock
	updateDevice: Mock
	addDevice: Mock
	getConfigurationTemplates: Mock
	createConfigurationTemplate: Mock
	importConfigurationTemplates: Mock
	getDeviceConfigurationParams: Mock
	updateConfigurationTemplate: Mock
	deleteConfigurationTemplate: Mock
	applyConfigurationTemplate: Mock
	enableStatistics: Mock
	disableStatistics: Mock
	cacheSnippets: ZwaveClientPort['cacheSnippets']
	addExtraLogTransport: Mock
	removeExtraLogTransport: Mock
	dumpNode: Mock
	getNode: Mock
	nodes: { get: Mock }
	restart: Mock
	setUserCallbacks: Mock
	removeUserCallbacks: Mock
	backupNVMRaw: Mock
}

export function createFakeZwaveClient(
	overrides: Partial<ZwaveClientPort> = {},
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
		storeDevices: vi.fn(() =>
			Promise.resolve({
				status: 'stored',
			} satisfies StoreHassDevicesResult),
		),
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
		setUserCallbacks: vi.fn(),
		removeUserCallbacks: vi.fn(),
		backupNVMRaw: vi.fn(() =>
			Promise.resolve({ fileName: '/tmp/nvm-backup.bin' }),
		),
		...overrides,
	}
}

export interface FakeMqttClient extends MqttClientPort {
	getStatus: Mock
}

export function createFakeMqttClient(
	overrides: Partial<MqttClientPort> = {},
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

export interface FakeGateway extends GatewayPort {
	zwave?: FakeZwaveClient
	mqtt?: FakeMqttClient
	close: Mock
	start: Mock
	updateNodeTopics: Mock
	removeNodeRetained: Mock
	publishDiscovery: Mock
	rediscoverNode: Mock
	disableDiscovery: Mock
	buildDiscoveryOptions: Mock
	adoptDiscoveryManager: Mock
}

export function createFakeGateway(
	overrides: Partial<GatewayPort> = {},
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
		buildDiscoveryOptions: vi.fn(() => createFakeDiscoveryOptions()),
		adoptDiscoveryManager: vi.fn(),
		...overrides,
	}
}

/**
 * A valid but inert `MqttDiscoveryManagerOptions` for a fake gateway. The
 * runtime's `attachClients()` builds a real `MqttDiscoveryManager` from these
 * during `startGateway()`, but a fake gateway's `start()` never starts it, so
 * the ports below are never exercised and no MQTT or file I/O occurs. The
 * registry source is a real, unstarted registry so the manager's constructor
 * `fork()` succeeds without installing any file watchers.
 */
function createFakeDiscoveryOptions(): MqttDiscoveryManagerOptions {
	const logger = {
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		log: vi.fn(),
	}
	return {
		config: { hassDiscovery: false },
		mqtt: {
			disabled: true,
			getTopic: vi.fn(() => ''),
			getStatusTopic: vi.fn(() => ''),
			publish: vi.fn(),
		},
		zwave: {
			homeHex: undefined,
			getNode: vi.fn(() => undefined),
			getNodes: vi.fn((): Iterable<readonly [number, unknown]> => []),
			updateDevice: vi.fn(),
			emitNodeUpdate: vi.fn(),
			writeCoverStop: vi.fn(() => Promise.resolve(undefined)),
		},
		topics: {
			nodeTopic: vi.fn(() => ''),
			valueTopic: vi.fn(() => null),
		},
		registrySource: new CustomDeviceRegistry({
			storeDir: path.join(tmpdir(), 'zwave-js-ui-fake-gateway-registry'),
			logger,
		}),
		logger,
	}
}

// Avoids constructing a real Zniffer, which would open a real serial port
export interface FakeZniffer extends ZnifferPort {
	status: Mock
	start: Mock
	stop: Mock
	clear: Mock
	getFrames: Mock
	setFrequency: Mock
	setLRChannelConfig: Mock
	saveCaptureToFile: Mock
	loadCaptureFromBuffer: Mock
	// AppInstance.close() calls this unconditionally when a zniffer is set, mirroring FakeGateway.close
	close: Mock
}

export function createFakeZniffer(
	overrides: Partial<FakeZniffer> = {},
): FakeZniffer {
	return {
		status: vi.fn(() => ({ active: false, frequency: undefined })),
		start: vi.fn(() => Promise.resolve(undefined)),
		stop: vi.fn(() => Promise.resolve(undefined)),
		clear: vi.fn(() => undefined),
		getFrames: vi.fn(() => []),
		setFrequency: vi.fn(() => Promise.resolve(undefined)),
		setLRChannelConfig: vi.fn(() => Promise.resolve(undefined)),
		saveCaptureToFile: vi.fn(() => Promise.resolve('/tmp/capture.zlf')),
		// Returns a promise like the real method, so the missing await in production leaves an unresolved promise that serializes to {} over the wire
		loadCaptureFromBuffer: vi.fn(() => Promise.resolve(undefined)),
		close: vi.fn(() => Promise.resolve(undefined)),
		...overrides,
	}
}
