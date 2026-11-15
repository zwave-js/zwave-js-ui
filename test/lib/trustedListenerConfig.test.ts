import { describe, expect, it } from 'vitest'
import { parseCidr, parseIp } from '../../api/lib/ipUtils.ts'
import {
	isAllowedAddress,
	parseTrustedListenerConfig,
	resolveListenAddress,
} from '../../api/lib/trustedListener.ts'

describe('parseTrustedListenerConfig', () => {
	it('returns undefined when TRUSTED_API_LISTEN is unset or empty', () => {
		expect(parseTrustedListenerConfig({})).toBeUndefined()
		expect(
			parseTrustedListenerConfig({ TRUSTED_API_LISTEN: '  ' }),
		).toBeUndefined()
	})

	it('parses a unix socket path without requiring an allowlist', () => {
		expect(
			parseTrustedListenerConfig({ TRUSTED_API_LISTEN: '/run/zui.sock' }),
		).toEqual({ kind: 'unix', path: '/run/zui.sock' })
	})

	it('parses a literal host:port', () => {
		const config = parseTrustedListenerConfig({
			TRUSTED_API_LISTEN: '127.0.0.1:8092',
			TRUSTED_API_ALLOWED_IPS: '172.30.32.2',
		})
		expect(config).toMatchObject({
			kind: 'tcp',
			host: '127.0.0.1',
			port: 8092,
		})
	})

	it('parses a bracketed IPv6 host', () => {
		const config = parseTrustedListenerConfig({
			TRUSTED_API_LISTEN: '[::1]:8092',
			TRUSTED_API_ALLOWED_IPS: '::1',
		})
		expect(config).toMatchObject({ kind: 'tcp', host: '::1', port: 8092 })
	})

	it('parses a cidr:port host as a network to resolve at bind time', () => {
		const config = parseTrustedListenerConfig({
			TRUSTED_API_LISTEN: '172.30.32.0/23:8092',
			TRUSTED_API_ALLOWED_IPS: '172.30.32.2',
		})
		expect(config).toBeDefined()
		expect(config.kind).toBe('tcp')
		if (config.kind === 'tcp') {
			expect(config.host).toEqual(parseCidr('172.30.32.0/23'))
		}
	})

	it('parses allowlist entries as IPs and CIDRs', () => {
		const config = parseTrustedListenerConfig({
			TRUSTED_API_LISTEN: '127.0.0.1:8092',
			TRUSTED_API_ALLOWED_IPS: ' 172.30.32.2, 10.0.0.0/8 ',
		})
		expect(config).toBeDefined()
		if (config.kind === 'tcp') {
			expect(config.allowedIps).toEqual([
				{ addr: parseIp('172.30.32.2'), prefix: 32 },
				parseCidr('10.0.0.0/8'),
			])
		}
	})

	it('rejects a bare port', () => {
		expect(() =>
			parseTrustedListenerConfig({
				TRUSTED_API_LISTEN: '8092',
				TRUSTED_API_ALLOWED_IPS: '127.0.0.1',
			}),
		).toThrow(/TRUSTED_API_LISTEN/)
	})

	it('rejects a hostname', () => {
		expect(() =>
			parseTrustedListenerConfig({
				TRUSTED_API_LISTEN: 'localhost:8092',
				TRUSTED_API_ALLOWED_IPS: '127.0.0.1',
			}),
		).toThrow(/literal IP or CIDR/)
	})

	it('rejects TCP binding without an allowlist', () => {
		expect(() =>
			parseTrustedListenerConfig({
				TRUSTED_API_LISTEN: '127.0.0.1:8092',
			}),
		).toThrow(/TRUSTED_API_ALLOWED_IPS/)
	})

	it('rejects invalid allowlist entries', () => {
		expect(() =>
			parseTrustedListenerConfig({
				TRUSTED_API_LISTEN: '127.0.0.1:8092',
				TRUSTED_API_ALLOWED_IPS: 'not-an-ip',
			}),
		).toThrow(/invalid IP/)
		expect(() =>
			parseTrustedListenerConfig({
				TRUSTED_API_LISTEN: '127.0.0.1:8092',
				TRUSTED_API_ALLOWED_IPS: '10.0.0.0/99',
			}),
		).toThrow(/invalid CIDR/)
	})

	it('rejects an invalid port', () => {
		for (const port of ['0', '99999']) {
			expect(() =>
				parseTrustedListenerConfig({
					TRUSTED_API_LISTEN: `127.0.0.1:${port}`,
					TRUSTED_API_ALLOWED_IPS: '127.0.0.1',
				}),
			).toThrow(/invalid port/)
		}
	})
})

describe('isAllowedAddress', () => {
	const allowed = [
		parseCidr('172.30.32.0/23'),
		parseCidr('127.0.0.1/32'),
		parseCidr('fd00::/8'),
	]

	it('matches exact IPs and CIDR ranges', () => {
		expect(isAllowedAddress('127.0.0.1', allowed)).toBe(true)
		expect(isAllowedAddress('172.30.32.2', allowed)).toBe(true)
		expect(isAllowedAddress('172.30.33.200', allowed)).toBe(true)
		expect(isAllowedAddress('fd12::1', allowed)).toBe(true)
	})

	it('rejects addresses outside the allowlist', () => {
		expect(isAllowedAddress('172.30.34.1', allowed)).toBe(false)
		expect(isAllowedAddress('10.0.0.1', allowed)).toBe(false)
		expect(isAllowedAddress('fe80::1', allowed)).toBe(false)
	})

	it('unwraps IPv4-mapped IPv6 addresses', () => {
		expect(isAllowedAddress('::ffff:172.30.32.2', allowed)).toBe(true)
		expect(isAllowedAddress('::ffff:10.0.0.1', allowed)).toBe(false)
	})

	it('rejects unparsable addresses', () => {
		expect(isAllowedAddress('garbage', allowed)).toBe(false)
		expect(isAllowedAddress('', allowed)).toBe(false)
	})
})

describe('resolveListenAddress', () => {
	const interfaces = {
		lo: [{ address: '127.0.0.1' }, { address: '::1' }],
		eth0: [{ address: '172.30.33.7' }, { address: 'fe80::1' }],
	} as any

	it('resolves the local address inside the network', () => {
		expect(
			resolveListenAddress(parseCidr('172.30.32.0/23'), interfaces),
		).toBe('172.30.33.7')
	})

	it('throws when no local address matches', () => {
		expect(() =>
			resolveListenAddress(parseCidr('10.0.0.0/8'), interfaces),
		).toThrow(/no local address/)
	})

	it('throws when multiple local addresses match', () => {
		const multi = {
			eth0: [{ address: '172.30.33.7' }],
			eth1: [{ address: '172.30.33.8' }],
		} as any
		expect(() =>
			resolveListenAddress(parseCidr('172.30.32.0/23'), multi),
		).toThrow(/multiple local addresses/)
	})
})
