// Extends the shared base fakes with the members only the Socket.IO wiring reads, so both suites share one FakeGateway/FakeZwaveClient shape
import { vi } from 'vitest'
import {
	createFakeGateway as createSharedFakeGateway,
	createFakeMqttClient,
	createFakeZwaveClient as createSharedFakeZwaveClient,
	type FakeGateway as SharedFakeGateway,
	type FakeMqttClient,
	type FakeZwaveClient as SharedFakeZwaveClient,
} from '../shared/fakes.ts'

export { createFakeMqttClient, type FakeMqttClient }

// setUserCallbacks/removeUserCallbacks fire on first-connect/last-disconnect in the 'clients' handler
export interface FakeZwaveClient extends SharedFakeZwaveClient {
	setUserCallbacks: ReturnType<typeof vi.fn>
	removeUserCallbacks: ReturnType<typeof vi.fn>
}

export function createFakeZwaveClient(
	overrides: Partial<FakeZwaveClient> = {},
): FakeZwaveClient {
	return {
		...createSharedFakeZwaveClient(overrides),
		setUserCallbacks: vi.fn(),
		removeUserCallbacks: vi.fn(),
		...overrides,
	}
}

// Avoids constructing a real Zniffer, which would open a real serial port
export interface FakeZniffer {
	status: ReturnType<typeof vi.fn>
	start: ReturnType<typeof vi.fn>
	stop: ReturnType<typeof vi.fn>
	clear: ReturnType<typeof vi.fn>
	getFrames: ReturnType<typeof vi.fn>
	setFrequency: ReturnType<typeof vi.fn>
	setLRChannelConfig: ReturnType<typeof vi.fn>
	saveCaptureToFile: ReturnType<typeof vi.fn>
	loadCaptureFromBuffer: ReturnType<typeof vi.fn>
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
		...overrides,
	}
}

export interface FakeGateway extends SharedFakeGateway {
	zwave?: FakeZwaveClient
}

export function createFakeGateway(
	overrides: Partial<FakeGateway> = {},
): FakeGateway {
	return {
		...createSharedFakeGateway(overrides as Partial<SharedFakeGateway>),
		zwave: createFakeZwaveClient(),
		...overrides,
	}
}
