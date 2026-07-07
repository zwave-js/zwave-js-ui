// Minimal IP address utilities for the trusted listener: parsing and CIDR
// matching only, so we don't need a dependency for it

export interface ParsedIp {
	kind: 'ipv4' | 'ipv6'
	/** 4 (IPv4) or 16 (IPv6) bytes, network order */
	bytes: number[]
}

export interface ParsedCidr {
	addr: ParsedIp
	prefix: number
}

function parseIpv4(raw: string): ParsedIp | undefined {
	const match = raw.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
	if (!match) return undefined
	const bytes: number[] = []
	for (const part of match.slice(1)) {
		// Reject leading zeros so ambiguous octal-looking octets fail loudly
		if (part.length > 1 && part.startsWith('0')) return undefined
		const value = parseInt(part, 10)
		if (value > 255) return undefined
		bytes.push(value)
	}
	return { kind: 'ipv4', bytes }
}

function parseIpv6(raw: string): ParsedIp | undefined {
	// Zone ids (fe80::1%eth0) are link-local and never valid peers here
	if (raw.includes('%')) return undefined

	const doubleColon = raw.indexOf('::')
	if (doubleColon !== raw.lastIndexOf('::')) return undefined

	let headRaw: string
	let tailRaw: string | undefined
	if (doubleColon >= 0) {
		headRaw = raw.slice(0, doubleColon)
		tailRaw = raw.slice(doubleColon + 2)
	} else {
		headRaw = raw
	}

	const parseGroups = (
		part: string,
		ipv4Allowed: boolean,
	): number[] | undefined => {
		if (part === '') return []
		const bytes: number[] = []
		const groups = part.split(':')
		for (let i = 0; i < groups.length; i++) {
			const group = groups[i]
			// An embedded IPv4 tail (::ffff:1.2.3.4) fills the last two groups
			if (group.includes('.')) {
				if (!ipv4Allowed || i !== groups.length - 1) return undefined
				const v4 = parseIpv4(group)
				if (!v4) return undefined
				bytes.push(...v4.bytes)
				continue
			}
			if (!/^[0-9a-fA-F]{1,4}$/.test(group)) return undefined
			const value = parseInt(group, 16)
			bytes.push(value >> 8, value & 0xff)
		}
		return bytes
	}

	const head = parseGroups(headRaw, tailRaw === undefined)
	const tail = tailRaw !== undefined ? parseGroups(tailRaw, true) : undefined
	if (!head || (tailRaw !== undefined && !tail)) return undefined

	let bytes: number[]
	if (tail) {
		// The '::' must stand for at least one zero group
		if (head.length + tail.length > 14) return undefined
		bytes = [
			...head,
			...new Array(16 - head.length - tail.length).fill(0),
			...tail,
		]
	} else {
		if (head.length !== 16) return undefined
		bytes = head
	}

	return { kind: 'ipv6', bytes }
}

/** Parse an IPv4 or IPv6 address, returning undefined on invalid input */
export function parseIp(raw: string): ParsedIp | undefined {
	return raw.includes(':') ? parseIpv6(raw) : parseIpv4(raw)
}

/** Unwrap an IPv4-mapped IPv6 address (::ffff:a.b.c.d) to its IPv4 form */
export function unwrapMappedIp(ip: ParsedIp): ParsedIp {
	if (
		ip.kind === 'ipv6' &&
		ip.bytes.slice(0, 10).every((b) => b === 0) &&
		ip.bytes[10] === 0xff &&
		ip.bytes[11] === 0xff
	) {
		return { kind: 'ipv4', bytes: ip.bytes.slice(12) }
	}
	return ip
}

/** Parse "addr/prefix" notation, returning undefined on invalid input */
export function parseCidr(raw: string): ParsedCidr | undefined {
	const slash = raw.indexOf('/')
	if (slash < 0 || raw.includes('/', slash + 1)) return undefined
	const addr = parseIp(raw.slice(0, slash))
	if (!addr) return undefined
	const prefixRaw = raw.slice(slash + 1)
	if (!/^\d{1,3}$/.test(prefixRaw)) return undefined
	const prefix = parseInt(prefixRaw, 10)
	if (prefix > addr.bytes.length * 8) return undefined
	return { addr, prefix }
}

/** Whether `ip` lies inside `cidr`; address families must match */
export function matchesCidr(ip: ParsedIp, cidr: ParsedCidr): boolean {
	if (ip.kind !== cidr.addr.kind) return false
	let bits = cidr.prefix
	for (let i = 0; bits > 0; i++, bits -= 8) {
		const mask = bits >= 8 ? 0xff : (0xff << (8 - bits)) & 0xff
		if ((ip.bytes[i] & mask) !== (cidr.addr.bytes[i] & mask)) {
			return false
		}
	}
	return true
}

export function formatIp(ip: ParsedIp): string {
	if (ip.kind === 'ipv4') {
		return ip.bytes.join('.')
	}

	const groups: number[] = []
	for (let i = 0; i < 16; i += 2) {
		groups.push((ip.bytes[i] << 8) | ip.bytes[i + 1])
	}

	// Compress the longest run of two or more zero groups as '::'
	let runStart = -1
	let runLength = 0
	for (let i = 0; i < groups.length; i++) {
		if (groups[i] !== 0) continue
		let end = i
		while (end < groups.length && groups[end] === 0) end++
		if (end - i > runLength) {
			runStart = i
			runLength = end - i
		}
		i = end
	}

	const hex = groups.map((g) => g.toString(16))
	if (runLength >= 2) {
		const head = hex.slice(0, runStart).join(':')
		const tail = hex.slice(runStart + runLength).join(':')
		return `${head}::${tail}`
	}
	return hex.join(':')
}

export function formatCidr(cidr: ParsedCidr): string {
	return `${formatIp(cidr.addr)}/${cidr.prefix}`
}
