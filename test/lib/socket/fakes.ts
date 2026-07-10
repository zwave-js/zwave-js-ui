/**
 * Socket-specific fakes, extending the HTTP contract suite's collaborator
 * fakes (`test/lib/http/fakes.ts`) instead of duplicating them. The Socket.IO
 * wiring in `api/app.ts` reads/calls a handful of members those fakes don't
 * need (`gw.zwave.setUserCallbacks`/`removeUserCallbacks`, a `zniffer`
 * collaborator), so this module re-exports the HTTP fakes' constructors and
 * layers the extra members on top - one shape-compatible `FakeZwaveClient`/
 * `FakeGateway` contract shared by both suites, not two drifting ones.
 */
import { vi } from 'vitest'
import {
	createFakeGateway as createHttpFakeGateway,
	createFakeMqttClient,
	createFakeZwaveClient as createHttpFakeZwaveClient,
	type FakeGateway as HttpFakeGateway,
	type FakeMqttClient,
	type FakeZwaveClient as HttpFakeZwaveClient,
} from '../http/fakes.ts'

export { createFakeMqttClient, type FakeMqttClient }

/**
 * `FakeZwaveClient` plus the two collaborators only the Socket.IO
 * `'clients'` (connect/disconnect) handler in `api/app.ts` calls:
 * `setUserCallbacks()`/`removeUserCallbacks()` are invoked when the first
 * client connects / the last one disconnects (see
 * `clientLifecycle.test.ts`).
 */
export interface FakeZwaveClient extends HttpFakeZwaveClient {
	setUserCallbacks: ReturnType<typeof vi.fn>
	removeUserCallbacks: ReturnType<typeof vi.fn>
}

export function createFakeZwaveClient(
	overrides: Partial<FakeZwaveClient> = {},
): FakeZwaveClient {
	return {
		...createHttpFakeZwaveClient(overrides),
		setUserCallbacks: vi.fn(),
		removeUserCallbacks: vi.fn(),
		...overrides,
	}
}

/**
 * Minimal, typed fake for `ZnifferManager` - the collaborator the
 * `ZNIFFER_API` inbound handler and the `INITED` handshake read through the
 * module-level `zniffer` variable. Every method is a `vi.fn()` so tests can
 * assert exact arguments/return values per test, without ever constructing a
 * real `Zniffer` (which would open a real serial port).
 */
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
		// NB: production's inbound `ZNIFFER_API` handler calls this one
		// synchronously (`res = zniffer.loadCaptureFromBuffer(buffer)`,
		// no `await`) - see `inboundApis.test.ts` for the resulting
		// characterized quirk. The fake still returns a resolved promise
		// (matching the real, real `async` method's return type) so that
		// quirk is observable rather than accidentally masked.
		loadCaptureFromBuffer: vi.fn(() => Promise.resolve(undefined)),
		...overrides,
	}
}

export interface FakeGateway extends HttpFakeGateway {
	zwave?: FakeZwaveClient
}

export function createFakeGateway(
	overrides: Partial<FakeGateway> = {},
): FakeGateway {
	return {
		...createHttpFakeGateway(overrides as Partial<HttpFakeGateway>),
		zwave: createFakeZwaveClient(),
		...overrides,
	}
}
