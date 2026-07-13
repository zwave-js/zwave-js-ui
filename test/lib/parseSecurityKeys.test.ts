import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { parseSecurityKeys } from '../../api/lib/utils.ts'
import type { ZwaveConfig } from '../../api/lib/ZwaveClient.ts'

// Proves parseSecurityKeys() still fails on a missing securityKeysLongRange map or a null persisted key value, now via an explicit TypeError instead of an incidental one

type PartialZWaveOptionsLike = {
	securityKeys?: Record<string, Buffer>
	securityKeysLongRange?: Record<string, Buffer>
}

const ENV_KEYS = [
	'NETWORK_KEY',
	'KEY_S2_Unauthenticated',
	'KEY_S2_Authenticated',
	'KEY_S2_AccessControl',
	'KEY_S0_Legacy',
	'KEY_LR_S2_Authenticated',
	'KEY_LR_S2_AccessControl',
] as const

let envSnapshot: Record<string, string | undefined>

beforeEach(() => {
	envSnapshot = {}
	for (const key of ENV_KEYS) {
		envSnapshot[key] = process.env[key]
		delete process.env[key]
	}
})

afterEach(() => {
	for (const key of ENV_KEYS) {
		if (envSnapshot[key] === undefined) {
			delete process.env[key]
		} else {
			process.env[key] = envSnapshot[key]
		}
	}
})

const STANDARD_KEY_A = 'a'.repeat(32)
const STANDARD_KEY_B = 'b'.repeat(32)
const LR_KEY_A = 'c'.repeat(32)
const LR_KEY_B = 'd'.repeat(32)

function parse(config: ZwaveConfig) {
	const options: PartialZWaveOptionsLike = {}
	parseSecurityKeys(config, options as never)
	return options
}

describe('#parseSecurityKeys()', () => {
	it('converts valid standard security keys to 16-byte buffers', () => {
		const options = parse({
			securityKeys: {
				S0_Legacy: STANDARD_KEY_A,
				S2_Unauthenticated: STANDARD_KEY_B,
			},
		})

		expect(options.securityKeys?.S0_Legacy).toEqual(
			Buffer.from(STANDARD_KEY_A, 'hex'),
		)
		expect(options.securityKeys?.S2_Unauthenticated).toEqual(
			Buffer.from(STANDARD_KEY_B, 'hex'),
		)
		expect(options.securityKeysLongRange).toEqual({})
	})

	it('converts valid Long Range security keys to buffers when a securityKeysLongRange map is already persisted', () => {
		const options = parse({
			securityKeys: {},
			securityKeysLongRange: {
				S2_Authenticated: LR_KEY_A,
				S2_AccessControl: LR_KEY_B,
			},
		})

		expect(options.securityKeysLongRange?.S2_Authenticated).toEqual(
			Buffer.from(LR_KEY_A, 'hex'),
		)
		expect(options.securityKeysLongRange?.S2_AccessControl).toEqual(
			Buffer.from(LR_KEY_B, 'hex'),
		)
	})

	it('applies NETWORK_KEY env var as S0_Legacy', () => {
		process.env.NETWORK_KEY = STANDARD_KEY_A
		const options = parse({})

		expect(options.securityKeys?.S0_Legacy).toEqual(
			Buffer.from(STANDARD_KEY_A, 'hex'),
		)
	})

	it('applies KEY_* env vars over persisted standard keys', () => {
		process.env.KEY_S2_Authenticated = STANDARD_KEY_B
		const options = parse({
			securityKeys: { S2_Authenticated: STANDARD_KEY_A },
		})

		expect(options.securityKeys?.S2_Authenticated).toEqual(
			Buffer.from(STANDARD_KEY_B, 'hex'),
		)
	})

	it('applies KEY_LR_* env vars over an already-persisted securityKeysLongRange map', () => {
		process.env.KEY_LR_S2_Authenticated = LR_KEY_B
		const options = parse({
			securityKeysLongRange: { S2_Authenticated: LR_KEY_A },
		})

		expect(options.securityKeysLongRange?.S2_Authenticated).toEqual(
			Buffer.from(LR_KEY_B, 'hex'),
		)
	})

	describe('preserved quirk: missing securityKeysLongRange map + KEY_LR_* env var', () => {
		it('throws a characterized TypeError instead of silently creating the map', () => {
			process.env.KEY_LR_S2_Authenticated = LR_KEY_A

			expect(() =>
				parse({
					// no securityKeysLongRange at all
					securityKeys: {},
				}),
			).toThrow(TypeError)
		})

		it('does not throw when no KEY_LR_* env var is set, even with no securityKeysLongRange map', () => {
			expect(() =>
				parse({
					securityKeys: {},
				}),
			).not.toThrow()
		})

		it('does not throw when securityKeysLongRange is already an (empty) object', () => {
			process.env.KEY_LR_S2_Authenticated = LR_KEY_A

			expect(() =>
				parse({
					securityKeys: {},
					securityKeysLongRange: {},
				}),
			).not.toThrow()
		})
	})

	describe('preserved quirk: null persisted key values', () => {
		it('throws a characterized TypeError for a null standard security key', () => {
			expect(() =>
				parse({
					securityKeys: { S0_Legacy: null as unknown as string },
				}),
			).toThrow(TypeError)
		})

		it('throws a characterized TypeError for a null Long Range security key', () => {
			expect(() =>
				parse({
					securityKeysLongRange: {
						S2_Authenticated: null as unknown as string,
					},
				}),
			).toThrow(TypeError)
		})
	})

	describe('invalid-length keys are silently omitted (unchanged, pre-existing behavior)', () => {
		it('omits a standard security key of the wrong length', () => {
			const options = parse({
				securityKeys: { S0_Legacy: 'too-short' },
			})

			expect(options.securityKeys?.S0_Legacy).toBeUndefined()
		})

		it('omits a Long Range security key of the wrong length', () => {
			const options = parse({
				securityKeysLongRange: { S2_Authenticated: 'too-short' },
			})

			expect(
				options.securityKeysLongRange?.S2_Authenticated,
			).toBeUndefined()
		})

		it('omits an undefined security key without throwing', () => {
			const options = parse({
				securityKeys: { S0_Legacy: undefined },
			})

			expect(options.securityKeys?.S0_Legacy).toBeUndefined()
		})
	})

	describe('ordering', () => {
		it('defaults securityKeys unconditionally, but only defaults securityKeysLongRange right before its own conversion loop', () => {
			// With no KEY_LR_* env var, securityKeysLongRange is optional and the missing-map crash path is never reached
			const config: ZwaveConfig = {
				securityKeys: { S0_Legacy: STANDARD_KEY_A },
			}

			expect(() => parse(config)).not.toThrow()
			// Defaulted to {} as a side-effect on config itself
			expect(config.securityKeysLongRange).toEqual({})
		})

		it('mutates config.securityKeys/config.securityKeysLongRange in place with defaults + env overrides', () => {
			process.env.KEY_S0_Legacy = STANDARD_KEY_A
			const config: ZwaveConfig = {}

			parse(config)

			expect(config.securityKeys?.S0_Legacy).toBe(STANDARD_KEY_A)
			expect(config.securityKeysLongRange).toEqual({})
		})
	})
})
