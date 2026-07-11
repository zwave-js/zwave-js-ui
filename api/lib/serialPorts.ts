import { Driver } from 'zwave-js'

// A standalone module (rather than a local binding in api/app.ts) so tests
// can vi.mock it directly instead of needing a runtime seam to swap it out
export const enumerateSerialPorts: typeof Driver.enumerateSerialPorts =
	Driver.enumerateSerialPorts.bind(Driver)
