export type SocketAck<T> = (result: T) => void

// Read error.message directly so message-less throws yield undefined while nullish throws prevent an ACK
export function getLegacyErrorMessage(error: unknown): unknown {
	return (error as { message?: unknown }).message
}

export const noop = (): void => {}
