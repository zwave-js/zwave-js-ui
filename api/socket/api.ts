export type SocketAck<T> = (result: T) => void

export interface ApiAck<T> {
	success: boolean
	message: string
	result: T
	api?: string
}

export function createApiAck<T>(
	api: string | undefined,
	result: T,
	error: string | undefined,
	successMessage: string,
): ApiAck<T> {
	return {
		success: !error,
		message: error || successMessage,
		result,
		api,
	}
}

export function safeOperationName(value: unknown): string {
	if (typeof value !== 'string') return '<invalid>'

	let sanitized = ''
	for (const character of value) {
		const code = character.charCodeAt(0)
		// Keep printable ASCII and Unicode while removing C0, DEL, and C1 controls
		if ((code >= 32 && code < 127) || code > 159) {
			sanitized += character
		}
	}
	// Bound client-controlled log fields to 100 characters
	return sanitized.slice(0, 100)
}
