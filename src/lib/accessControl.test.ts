import { describe, expect, it } from 'vitest'
import type {
	AssignCredentialResult,
	SetCredentialResult,
	SetUserResult,
	UserCredentialAdminCodeOperationResult,
	UserCredentialLearnStatus,
} from './accessControl.ts'
import {
	UserCredentialType,
	assignCredentialResultMessage,
	escapeHtml,
	formatHex,
	isBinary,
	isDirectEntry,
	learnStatusMessage,
	maskCredential,
	nextFreeCredentialSlot,
	nextFreeUserSlot,
	setAdminCodeResultMessage,
	setCredentialResultMessage,
	setUserResultMessage,
} from './accessControl.ts'

describe('access control helpers', () => {
	it('allocates the first free user slot', () => {
		expect(nextFreeUserSlot([], 3)).toBe(1)
		expect(nextFreeUserSlot([{ userId: 1 }], 3)).toBe(2)
		expect(nextFreeUserSlot([{ userId: 1 }, { userId: 2 }], 3)).toBe(3)
		expect(
			nextFreeUserSlot([{ userId: 1 }, { userId: 2 }, { userId: 3 }], 3),
		).toBeUndefined()
	})

	it('allocates credential slots per type', () => {
		const credentials = [
			{ type: UserCredentialType.PINCode, slot: 1 },
			{ type: UserCredentialType.Password, slot: 2 },
		]
		expect(
			nextFreeCredentialSlot(credentials, UserCredentialType.PINCode, 3),
		).toBe(2)
		expect(
			nextFreeCredentialSlot(
				[
					...credentials,
					{ type: UserCredentialType.PINCode, slot: 2 },
					{ type: UserCredentialType.PINCode, slot: 3 },
				],
				UserCredentialType.PINCode,
				3,
			),
		).toBeUndefined()
	})

	it('uses a fixed mask for every credential value', () => {
		expect(maskCredential({})).toBe('—')
		expect(maskCredential({ data: '' })).toBe('••••••••')
		expect(maskCredential({ data: '12' })).toBe('••••••••')
		expect(maskCredential({ data: '01020304' })).toBe('••••••••')
	})

	it('formats hexadecimal values in byte pairs', () => {
		expect(formatHex('')).toBe('')
		expect(formatHex('abc')).toBe('AB C')
		expect(formatHex('0102ff')).toBe('01 02 FF')
	})

	it('classifies direct-entry and binary credential types', () => {
		expect(isDirectEntry(UserCredentialType.PINCode)).toBe(true)
		expect(isDirectEntry(UserCredentialType.Password)).toBe(true)
		expect(isDirectEntry(UserCredentialType.RFIDCode)).toBe(false)
		expect(isBinary(UserCredentialType.RFIDCode)).toBe(true)
		expect(isBinary(UserCredentialType.PINCode)).toBe(false)
	})

	it('maps unknown operation results to fallback messages', () => {
		expect(setUserResultMessage(999 as SetUserResult)).toBe(
			'The lock did not confirm the change.',
		)
		expect(setCredentialResultMessage(999 as SetCredentialResult)).toBe(
			'The lock did not confirm the change.',
		)
		expect(
			assignCredentialResultMessage(999 as AssignCredentialResult),
		).toBe('The lock did not confirm the change.')
		expect(
			setAdminCodeResultMessage(
				999 as UserCredentialAdminCodeOperationResult,
			),
		).toBe('The lock did not confirm the change.')
		expect(learnStatusMessage(999 as UserCredentialLearnStatus)).toBe(
			'Enrollment in progress…',
		)
	})

	it('escapes values embedded in confirmation HTML', () => {
		expect(escapeHtml(`<Admin & "Guest">'`)).toBe(
			'&lt;Admin &amp; &quot;Guest&quot;&gt;&#39;',
		)
	})
})
