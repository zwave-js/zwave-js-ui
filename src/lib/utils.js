import { isValidDSK } from '@zwave-js/core/safe'

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
					.join(',')
		: 'Unknown battery level'
}
