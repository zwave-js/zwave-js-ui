export type SocketAck<T> = (result: T) => void

// Read error.message directly to preserve primitive/object undefined and null no-ACK behavior
export function getLegacyErrorMessage(error: unknown): unknown {
	return (error as { message?: unknown }).message
}

export const noop = (): void => {}
