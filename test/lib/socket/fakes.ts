// Extends the shared base fakes with the members only the Socket.IO wiring reads, so both suites share one FakeGateway/FakeZwaveClient shape
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

export type FakeZwaveClient = SharedFakeZwaveClient

export function createFakeZwaveClient(
	overrides: Partial<FakeZwaveClient> = {},
): FakeZwaveClient {
	return createSharedFakeZwaveClient(overrides)
}

export interface FakeGateway extends SharedFakeGateway {
	zwave?: FakeZwaveClient
}

export type FakeGatewayWithClient = FakeGateway & {
	zwave: FakeZwaveClient
}

export function createFakeGateway(
	overrides: Partial<FakeGateway> & {
		zwave: undefined
	},
): FakeGateway
export function createFakeGateway(
	overrides?: Partial<Omit<FakeGateway, 'zwave'>> & {
		zwave?: FakeZwaveClient
	},
): FakeGatewayWithClient
export function createFakeGateway(
	overrides: Partial<FakeGateway> = {},
): FakeGateway {
	return {
		...createSharedFakeGateway(),
		zwave: createFakeZwaveClient(),
		...overrides,
	}
}
