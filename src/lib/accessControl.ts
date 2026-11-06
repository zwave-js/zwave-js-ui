import {
	UserCredentialAdminCodeOperationResult,
	UserCredentialLearnStatus,
	UserCredentialRule,
	UserCredentialType,
	UserCredentialUserType,
} from '@zwave-js/cc'
import {
	AssignCredentialResult,
	SetCredentialResult,
	SetUserResult,
} from 'zwave-js'
import type {
	ZUIAccessControl as AccessControlState,
	ZUIAccessControlCapabilities as AccessControlCapabilities,
	ZUIAccessControlCapabilityType as AccessControlCapabilityType,
	ZUIAccessControlCredential as AccessControlCredential,
	ZUIAccessControlEndpoint as AccessControlEndpoint,
	ZUIAccessControlUser as AccessControlUser,
} from '@server/lib/ZwaveClient'

export {
	AssignCredentialResult,
	SetCredentialResult,
	SetUserResult,
	UserCredentialAdminCodeOperationResult,
	UserCredentialLearnStatus,
	UserCredentialRule,
	UserCredentialType,
	UserCredentialUserType,
}
export type {
	AccessControlCapabilities,
	AccessControlCapabilityType,
	AccessControlCredential,
	AccessControlEndpoint,
	AccessControlState,
	AccessControlUser,
}

const CREDENTIAL_MASK = '••••••••'

export function isAdminCodeSuccess(
	r: UserCredentialAdminCodeOperationResult,
): boolean {
	return (
		r === UserCredentialAdminCodeOperationResult.Modified ||
		r === UserCredentialAdminCodeOperationResult.Unmodified
	)
}

export function setAdminCodeResultMessage(
	r: UserCredentialAdminCodeOperationResult,
): string {
	switch (r) {
		case UserCredentialAdminCodeOperationResult.Modified:
			return 'Admin code updated.'
		case UserCredentialAdminCodeOperationResult.Unmodified:
			return 'Admin code unchanged.'
		case UserCredentialAdminCodeOperationResult.FailDuplicateCredential:
			return 'This value is already in use as a user PIN.'
		case UserCredentialAdminCodeOperationResult.FailManufacturerSecurityRule:
			return 'The lock refused this value.'
		case UserCredentialAdminCodeOperationResult.ErrorNotSupported:
			return 'This lock does not support setting an admin code.'
		case UserCredentialAdminCodeOperationResult.ErrorDisablingNotSupported:
			return 'This lock does not support clearing the admin code.'
		default:
			return 'The lock did not confirm the change.'
	}
}

export const userTypeLabels: Record<number, string> = {
	[UserCredentialUserType.General]: 'General',
	[UserCredentialUserType.Programming]: 'Programming',
	[UserCredentialUserType.NonAccess]: 'Non-Access',
	[UserCredentialUserType.Duress]: 'Duress',
	[UserCredentialUserType.Disposable]: 'Disposable',
	[UserCredentialUserType.Expiring]: 'Expiring',
	[UserCredentialUserType.RemoteOnly]: 'Remote-Only',
}

export const credentialTypeLabels: Record<number, string> = {
	[UserCredentialType.PINCode]: 'PIN',
	[UserCredentialType.Password]: 'Password',
	[UserCredentialType.RFIDCode]: 'RFID',
	[UserCredentialType.BLE]: 'BLE',
	[UserCredentialType.NFC]: 'NFC',
	[UserCredentialType.UWB]: 'UWB',
	[UserCredentialType.EyeBiometric]: 'Eye',
	[UserCredentialType.FaceBiometric]: 'Face',
	[UserCredentialType.FingerBiometric]: 'Fingerprint',
	[UserCredentialType.HandBiometric]: 'Hand',
	[UserCredentialType.UnspecifiedBiometric]: 'Biometric',
	[UserCredentialType.DESFire]: 'DESFire',
}

export const credentialTypeIcons: Record<number, string> = {
	[UserCredentialType.PINCode]: 'pin',
	[UserCredentialType.Password]: 'password',
	[UserCredentialType.RFIDCode]: 'nfc',
	[UserCredentialType.BLE]: 'bluetooth',
	[UserCredentialType.NFC]: 'nfc',
	[UserCredentialType.UWB]: 'radar',
	[UserCredentialType.EyeBiometric]: 'visibility',
	[UserCredentialType.FaceBiometric]: 'face',
	[UserCredentialType.FingerBiometric]: 'fingerprint',
	[UserCredentialType.HandBiometric]: 'back_hand',
	[UserCredentialType.UnspecifiedBiometric]: 'precision_manufacturing',
	[UserCredentialType.DESFire]: 'credit_card',
}

export const ruleLabels: Record<number, string> = {
	[UserCredentialRule.Single]: '1 credential',
	[UserCredentialRule.Dual]: '2 credentials',
	[UserCredentialRule.Triple]: '3 credentials',
}

export const userTypeDescriptions: Record<number, string> = {
	[UserCredentialUserType.General]: 'Standard user — full access.',
	[UserCredentialUserType.Programming]:
		'Can manage other users at the lock keypad.',
	[UserCredentialUserType.NonAccess]:
		'Identity only — does not unlock the door.',
	[UserCredentialUserType.Duress]:
		'Unlocks and silently triggers a duress alarm.',
	[UserCredentialUserType.Disposable]:
		'Deletes itself after the first successful use.',
	[UserCredentialUserType.Expiring]:
		'Deactivates after the configured time elapses.',
	[UserCredentialUserType.RemoteOnly]:
		'Tracked at the lock but only usable through the hub.',
}

export function userTypeDescription(t: number): string {
	return userTypeDescriptions[t] ?? ''
}

export const ruleDescription =
	'How many credentials must be presented together at the door.'

export const userTypeTone: Record<number, string> = {
	[UserCredentialUserType.General]: 'default',
	[UserCredentialUserType.Programming]: 'info',
	[UserCredentialUserType.NonAccess]: 'default',
	[UserCredentialUserType.Duress]: 'error',
	[UserCredentialUserType.Disposable]: 'warning',
	[UserCredentialUserType.Expiring]: 'warning',
	[UserCredentialUserType.RemoteOnly]: 'default',
}

export const directEntryTypes = new Set<UserCredentialType>([
	UserCredentialType.PINCode,
	UserCredentialType.Password,
])

export const binaryTypes = new Set<UserCredentialType>([
	UserCredentialType.RFIDCode,
	UserCredentialType.BLE,
	UserCredentialType.NFC,
	UserCredentialType.UWB,
	UserCredentialType.EyeBiometric,
	UserCredentialType.FaceBiometric,
	UserCredentialType.FingerBiometric,
	UserCredentialType.HandBiometric,
	UserCredentialType.UnspecifiedBiometric,
	UserCredentialType.DESFire,
])

export function userTypeLabel(t: number): string {
	return userTypeLabels[t] ?? `Type ${t}`
}

export function credentialTypeLabel(t: number): string {
	return credentialTypeLabels[t] ?? `Type ${t}`
}

export function credentialTypeIcon(t: number): string {
	return credentialTypeIcons[t] ?? 'key'
}

export function isDirectEntry(t: number): boolean {
	return directEntryTypes.has(t)
}

export function isBinary(t: number): boolean {
	return binaryTypes.has(t)
}

export function setUserResultMessage(r: SetUserResult): string {
	switch (r) {
		case SetUserResult.OK:
			return 'User saved.'
		case SetUserResult.Error_AddRejectedLocationOccupied:
			return 'That slot is already in use.'
		case SetUserResult.Error_ModifyRejectedLocationEmpty:
			return 'The user was deleted on the device. The list will refresh automatically.'
		default:
			return 'The lock did not confirm the change.'
	}
}

export function setCredentialResultMessage(r: SetCredentialResult): string {
	switch (r) {
		case SetCredentialResult.OK:
			return 'Credential saved.'
		case SetCredentialResult.Error_AddRejectedLocationOccupied:
			return 'That credential slot is already in use.'
		case SetCredentialResult.Error_ModifyRejectedLocationEmpty:
			return 'The credential is gone. The list will refresh automatically.'
		case SetCredentialResult.Error_DuplicateCredential:
			return 'This value is already in use elsewhere on the lock.'
		case SetCredentialResult.Error_ManufacturerSecurityRules:
			return 'The lock refused this value.'
		case SetCredentialResult.Error_DuplicateAdminPINCode:
			return 'This value is already in use elsewhere on the lock.'
		case SetCredentialResult.Error_WrongUserUniqueIdentifier:
			return 'That user does not exist.'
		default:
			return 'The lock did not confirm the change.'
	}
}

export function assignCredentialResultMessage(
	r: AssignCredentialResult,
): string {
	switch (r) {
		case AssignCredentialResult.OK:
			return 'Credential reassigned.'
		case AssignCredentialResult.Error_InvalidCredential:
			return 'The source credential is empty or invalid.'
		case AssignCredentialResult.Error_InvalidUser:
			return 'The destination user does not exist.'
		default:
			return 'The lock did not confirm the change.'
	}
}

export function learnStatusMessage(s: UserCredentialLearnStatus): string {
	switch (s) {
		case UserCredentialLearnStatus.Started:
			return 'Enrollment started.'
		case UserCredentialLearnStatus.Success:
			return 'Enrollment succeeded.'
		case UserCredentialLearnStatus.AlreadyInProgress:
			return 'Another enrollment is already running on the lock.'
		case UserCredentialLearnStatus.Timeout:
			return 'Timed out — no credential captured.'
		case UserCredentialLearnStatus.EndedNotDueToTimeout:
			return 'Enrollment ended without capturing a credential.'
		case UserCredentialLearnStatus.StepRetry:
			return 'Step needs to be retried.'
		case UserCredentialLearnStatus.InvalidAddOperationType:
		case UserCredentialLearnStatus.InvalidModifyOperationType:
			return 'The lock refused the operation.'
		default:
			return 'Enrollment in progress…'
	}
}

export function maskCredential(
	c: Pick<AccessControlCredential, 'data'>,
): string {
	if (c.data == null) return '—'
	return CREDENTIAL_MASK
}

export function formatHex(hex: string): string {
	if (!hex) return ''
	return (
		hex
			.toUpperCase()
			.match(/.{1,2}/g)
			?.join(' ') ?? hex
	)
}

export function nextFreeUserSlot(
	users: Pick<AccessControlUser, 'userId'>[],
	maxUsers: number,
): number | undefined {
	const used = new Set(users.map((u) => u.userId))
	for (let i = 1; i <= maxUsers; i++) {
		if (!used.has(i)) return i
	}
	return undefined
}

export function nextFreeCredentialSlot(
	credentials: Pick<AccessControlCredential, 'type' | 'slot'>[],
	type: number,
	max: number,
): number | undefined {
	const used = new Set(
		credentials.filter((c) => c.type === type).map((c) => c.slot),
	)
	for (let i = 1; i <= max; i++) {
		if (!used.has(i)) return i
	}
	return undefined
}

export function escapeHtml(value: string): string {
	const entities: Record<string, string> = {
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;',
		'"': '&quot;',
		"'": '&#39;',
	}
	return value.replace(/[&<>"']/g, (character) => entities[character])
}
