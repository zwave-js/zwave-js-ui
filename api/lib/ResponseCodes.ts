export const RESPONSE_CODES = {
	OK: 'OK',
	GENERAL_ERROR: 'General Error',
	INVALID: 'Invalid data',
	AUTH_FAILED: 'Authentication failed',
	PERMISSION_ERROR: 'Insufficient permissions',
} as const

export type ResponseCode = (typeof RESPONSE_CODES)[keyof typeof RESPONSE_CODES]
