// Extends the shared base fakes with the members only the Socket.IO wiring reads, so both suites share one FakeGateway/FakeZwaveClient shape
import { vi } from 'vitest'
import {
	createFakeGateway as createSharedFakeGateway,
	createFakeMqttClient,
	createFakeZniffer,
	createFakeZwaveClient as createSharedFakeZwaveClient,
	type FakeGateway as SharedFakeGateway,
	type FakeMqttClient,
	type FakeZniffer,
	type FakeZwaveClient as SharedFakeZwaveClient,
} from '../shared/fakes.ts'

export {
	createFakeMqttClient,
	type FakeMqttClient,
	createFakeZniffer,
	type FakeZniffer,
}

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
