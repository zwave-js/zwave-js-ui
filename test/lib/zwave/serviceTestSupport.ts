import { vi, type MockInstance } from 'vitest'

import type { ServiceLogger } from '#api/lib/zwave/ports.ts'
export {
	createDeferred,
	requireDefined,
	type Deferred,
} from '../testUtils.ts'

export type MockServiceLogger = ServiceLogger & {
	info: MockInstance<ServiceLogger['info']>
	warn: MockInstance<ServiceLogger['warn']>
	error: MockInstance<ServiceLogger['error']>
}

export function createServiceLogger(): MockServiceLogger {
	return {
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	}
}
