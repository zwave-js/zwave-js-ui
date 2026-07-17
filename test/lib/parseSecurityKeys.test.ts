import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { parseSecurityKeys } from '#api/lib/utils.ts'
import type { ZwaveConfig } from '#api/lib/ZwaveClient.ts'
import type { PartialZWaveOptions } from 'zwave-js'

let envSnapshot: NodeJS.ProcessEnv

beforeEach(() => {
	envSnapshot = { ...process.env }
	for (const key of Object.keys(process.env)) {
		if (key === 'NETWORK_KEY' || key.startsWith('KEY_')) {
			delete process.env[key]
		}
	}
})

afterEach(() => {
	for (const key of Object.keys(process.env)) {
		delete process.env[key]
	}
	Object.assign(process.env, envSnapshot)
})

const STANDARD_KEY_A = 'a'.repeat(32)
const STANDARD_KEY_B = 'b'.repeat(32)
const LR_KEY_A = 'c'.repeat(32)
const LR_KEY_B = 'd'.repeat(32)

function parse(config: ZwaveConfig): PartialZWaveOptions {
	const options: PartialZWaveOptions = {}
	parseSecurityKeys(config, options)
	return options
}

describe('security key parsing', () => {
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

	describe('missing securityKeysLongRange map + KEY_LR_* env var (see #4736)', () => {
		it('rejects the environment key when persisted Long Range storage is absent', () => {
			process.env.KEY_LR_S2_Authenticated = LR_KEY_A

			expect(() =>
				parse({
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

		it('accepts the environment key when persisted Long Range storage exists', () => {
			process.env.KEY_LR_S2_Authenticated = LR_KEY_A

			expect(() =>
				parse({
					securityKeys: {},
					securityKeysLongRange: {},
				}),
			).not.toThrow()
		})
	})

	describe('null persisted key values (see #4736)', () => {
		it('rejects a null standard security key', () => {
			const config: ZwaveConfig = JSON.parse(
				'{"securityKeys":{"S0_Legacy":null}}',
			)
			expect(() => parse(config)).toThrow(TypeError)
		})

		it('rejects a null Long Range security key', () => {
			const config: ZwaveConfig = JSON.parse(
				'{"securityKeysLongRange":{"S2_Authenticated":null}}',
			)
			expect(() => parse(config)).toThrow(TypeError)
		})
	})

	describe('invalid-length keys', () => {
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

		it('rejects an undefined standard security key', () => {
			expect(() =>
				parse({
					securityKeys: { S0_Legacy: undefined },
				}),
			).toThrow(TypeError)
		})
	})

	describe('provided settings updates', () => {
		it('initializes missing Long Range storage when no Long Range environment key is present', () => {
			const config: ZwaveConfig = {
				securityKeys: { S0_Legacy: STANDARD_KEY_A },
			}

			expect(() => parse(config)).not.toThrow()
			expect(config.securityKeysLongRange).toEqual({})
		})

		it('applies defaults and environment overrides to the provided settings', () => {
			process.env.KEY_S0_Legacy = STANDARD_KEY_A
			const config: ZwaveConfig = {}

			parse(config)

			expect(config.securityKeys?.S0_Legacy).toBe(STANDARD_KEY_A)
			expect(config.securityKeysLongRange).toEqual({})
		})
	})
})
