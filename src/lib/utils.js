import {
	isValidDSK,
	Protocols,
	znifferProtocolDataRateToString,
} from '@zwave-js/core/safe'

import {
	isRssiError,
	rssiToString,
	getEnumMemberName,
	ZWaveFrameType,
	LongRangeFrameType,
} from 'zwave-js/safe'
import { znifferRegions } from './items'
import { mdiZWave } from '@mdi/js'

export function copy(o) {
	return JSON.parse(JSON.stringify(o))
}

export function noop() {}

export function wait(ms) {
	return new Promise((r) => setTimeout(r, ms))
}

export function padNumber(num, digits) {
	return typeof num === 'number'
		? num.toString().padStart(digits, '0')
		: 'unknown'
}

export function wrapFunc(fn, ...args) {
	return (...args2) => fn(...args2, ...args)
}

export function uuid() {
	return Math.random().toString(36).substring(2, 15)
}

export function readAsBuffer(file) {
	return new Promise((resolve, reject) => {
		const reader = new FileReader()
		reader.onload = () => resolve(reader.result)
		reader.onerror = reject
		reader.readAsArrayBuffer(file)
	})
}

export function parseSecurityClasses(securityClasses, defaultVal) {
	securityClasses = Array.isArray(securityClasses) ? securityClasses : []
	const classes = {
		s2AccessControl: defaultVal,
		s2Authenticated: defaultVal,
		s2Unauthenticated: defaultVal,
		s0Legacy: defaultVal,
	}

	for (const c of securityClasses) {
		switch (c) {
			case 0:
				classes.s2Unauthenticated = true
				break
			case 1:
				classes.s2Authenticated = true
				break
			case 2:
				classes.s2AccessControl = true
				break
			case 7:
				classes.s0Legacy = true
				break
			default:
				break
		}
	}

	return classes
}

export function securityClassesToArray(securityClasses) {
	const classes = []
	securityClasses = securityClasses || {}
	for (const c in securityClasses) {
		if (securityClasses[c] === true) {
			switch (c) {
				case 's2AccessControl':
					classes.push(2)
					break
				case 's2Authenticated':
					classes.push(1)
					break
				case 's2Unauthenticated':
					classes.push(0)
					break
				case 's0Legacy':
					classes.push(7)
					break
				default:
					break
			}
		}
	}

	return classes
}

export function validDsk(dsk) {
	return isValidDSK(dsk) || 'Code not valid'
}

// Does something like vue $set: https://github.com/vuejs/vue/blob/edf7df0c837557dd3ea8d7b42ad8d4b21858ade0/dist/vue.common.dev.js#L1058
export function $set(o, p, v) {
	return Object.assign(o, { [p]: v })
}

export function jsonToList(obj, options = {}, level = 0) {
	if (obj === null || obj === undefined) {
		return ''
	}

	if (typeof obj !== 'object') {
		return obj.toString()
	}

	let s = ''
	let indent = '─'.repeat(level)

	const defaultOptions = { suffixes: {}, ignore: [] }

	options = Object.assign(defaultOptions, options)

	const { suffixes, ignore } = options

	if (indent) {
		indent = '└' + indent
	}

	for (const k in obj) {
		if (ignore.includes(k)) {
			continue
		}

		let value = obj[k]
		if (Array.isArray(value)) {
			value = value.join(', ')
		}

		if (value !== '') {
			s +=
				typeof value === 'object'
					? indent + k + '\n' + jsonToList(value, options, level + 1)
					: indent + k + ': ' + value + (suffixes[k] || '') + '\n'
		}
	}

	return s
}

export function validTopic(t) {
	const match = t
		? t.match(/[/a-zA-Z\u00C0-\u024F\u1E00-\u1EFF0-9 _-]+/g)
		: [t]

	return match?.[0] !== t ? 'Only a-zA-Z0-9_- chars are allowed' : true
}

export function deepEqual(a, b) {
	return a === b || JSON.stringify(a) === JSON.stringify(b)
}

export function arraysEqual(a, b) {
	if (a === b) return true
	if (a == null || b == null) return false
	if (a.length !== b.length) return false

	for (let i = 0; i < a.length; ++i) {
		if (a[i] !== b[i]) return false
	}

	return true
}

export function getBatteryDescription(node) {
	return typeof node.batteryLevels !== 'undefined'
		? 'All battery levels: ' +
				Object.values(node.batteryLevels)
					.map((v) => `${v}%`)
					.join(', ')
		: 'Unknown battery level'
}

export function isUndef(v) {
	return v === undefined || v === null || v === ''
}

export function getProtocol(node) {
	switch (node.protocol) {
		case Protocols.ZWave:
			return 'Z-Wave'
		case Protocols.ZWaveLongRange:
			return 'Z-Wave Long Range'
		default:
			return 'Unknown'
	}
}

export function getProtocolColor(node) {
	switch (node.protocol) {
		case Protocols.ZWave:
			return 'primary'
		case Protocols.ZWaveLongRange:
			return 'purple'
		default:
			return 'grey'
	}
}

export function getRegion(item) {
	return (
		znifferRegions.find((r) => r.value === item?.region)?.text ||
		`Unknown region ${item?.region}`
	)
}
export function getRoute(item, withRssi = false) {
	if (item.corrupted) {
		return ''
	}

	const repRSSI = item.repeaterRSSI || []
	const dir = item.direction === 'inbound' ? '←' : '→'
	const hop = item.hop !== undefined ? item.hop : -1
	const route = [
		item.direction === 'outbound'
			? item.sourceNodeId
			: item.destinationNodeId,
		...(item.repeaters || []),
		item.direction === 'outbound'
			? item.destinationNodeId
			: item.sourceNodeId,
	].map(
		(r, i) =>
			`${r}${
				withRssi && repRSSI[i - 1] && !isRssiError(repRSSI[i - 1])
					? ` (${rssiToString(repRSSI[i - 1])})`
					: ''
			}`,
	)

	let routeString = ''

	if (hop >= 0) {
		// highlight the hop
		for (let i = 0; i < route.length; i++) {
			routeString += route[i]
			if (i < route.length - 1) {
				if (i === item.failedHop) {
					routeString += ' ! '
				} else {
					routeString += ` ${
						hop === i ? '<b class="text-decoration-underline">' : ''
					}${dir}${hop === i ? '</b>' : ''} `
				}
			}
		}
	} else {
		routeString = route.join(` ${dir} `)
	}

	return routeString
}
export function getType(item) {
	if (item.corrupted) {
		return ''
	}

	if (item.protocol === Protocols.ZWaveLongRange) {
		return getEnumMemberName(LongRangeFrameType, item.type)
	} else {
		return getEnumMemberName(ZWaveFrameType, item.type)
	}
}
export function getRssi(item) {
	if (item.rssi && !isRssiError(item.rssi)) {
		return rssiToString(item.rssi)
	}

	return item.rssiRaw
}
export function getProtocolDataRate(item, withProtocol = true) {
	return item.protocolDataRate !== undefined
		? znifferProtocolDataRateToString(item.protocolDataRate, withProtocol)
		: '---'
}

/**  Human friendly number suffix */
export function humanFriendlyNumber(n, d) {
	const d2 = Math.pow(10, d)
	const s = ' KMGTPE'
	let i = 0
	const c = 1000

	while ((n >= c || n <= -c) && ++i < s.length) n = n / c

	i = i >= s.length ? s.length - 1 : i

	return Math.round(n * d2) / d2 + s[i]
}

export function openInWindow(title, height = 800, width = 600) {
	const newwindow = window.open(
		window.location.href + '/#no-topbar',
		title,
		`height=${height},width=${width},status=no,toolbar:no,scrollbars:no,menubar:no`, // check https://www.w3schools.com/jsref/met_win_open.asp for all available specs
	)
	if (window.focus) {
		newwindow.focus()
	}
}

export function isPopupWindow() {
	return window.opener !== null && window.opener !== window
}

export function getProtocolIcon(protocol) {
	if (typeof protocol === 'boolean') {
		protocol = protocol ? Protocols.ZWaveLongRange : Protocols.ZWave
	}

	return {
		align: 'center',
		icon: mdiZWave,
		iconStyle: `color: ${getProtocolColor({
			protocol,
		})}`,
		description: getProtocol({ protocol }),
	}
}

export function getAssociationAddress(ass) {
	return {
		nodeId: ass.nodeId,
		endpoint: ass.endpoint === null ? undefined : ass.endpoint,
	}
}
