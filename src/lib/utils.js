export function isUndef(v) {
	return v === undefined || v === null || v === ''
}

export function localDate(date) {
	return date ? new Date(date).toLocaleString() : '-----'
}

export function localDateOnly(date) {
	return date ? new Date(date).toLocaleDateString() : ''
}

export function arrayToString(array, prop) {
	if (!array || array.length === 0) return '-----'

	const props = prop ? array.map((g) => g[prop]) : array

	return props.join(', ')
}

export function copy(o) {
	return JSON.parse(JSON.stringify(o))
}
/**
 * Remove undefined, null and empty string properties from object
 *
 * @export
 * @param {any} object
 */
export function cleanObject(object) {
	for (const key in object) {
		if (isUndef(object[key])) {
			delete object[key]
		}
	}
}

export function getId(prefix) {
	return (
		(prefix ? `${prefix}_` : '') + Math.random().toString(36).substr(2, 10)
	)
}

export function hasProp(o, prop) {
	return Object.prototype.hasOwnProperty.call(o, prop)
}

export function arrayMove(arr, from, to) {
	if (to >= arr.length) {
		let k = to - arr.length + 1
		while (k--) {
			arr.push(undefined)
		}
	}
	arr.splice(to, 0, arr.splice(from, 1)[0])
	return arr
}

export function round(x, decimals) {
	// eslint-disable-next-line no-bitwise
	if (!decimals) return (+x + (x > 0 ? 0.5 : -0.5)) << 0
	return Number(`${Math.round(`${x}e${decimals}`)}e-${decimals}`)
}
/**
 * Get a property of object or return default `d`
 *
 * @param {any} o
 * @param {string} s
 * @param {any} d
 * @returns
 */
export function getProp(o, s, d) {
	s = s.replace(/\[(\w+)\]/g, '.$1') // convert indexes to properties
	s = s.replace(/^\./, '') // strip a leading dot
	const a = s.split('.')
	for (let i = 0, n = a.length; i < n; ++i) {
		const k = a[i]
		if (k in o) {
			o = o[k]
		} else {
			return d
		}
	}
	return o
}

export function setProp(o, p, v) {
	const paths = p.split('.')
	let iterator = o
	for (let i = 0; i < paths.length - 1; i++) {
		const prop = paths[i]
		if (iterator[prop] === undefined) {
			iterator[prop] = {}
		}
		iterator = iterator[prop]
	}

	iterator[paths[paths.length - 1]] = v
}

export function humanNumber(n, decimals = 2, retObj) {
	let i = 0
	const s = ' KMGTPE'
	const l = s.length

	while ((n >= 1000 || n <= -1000) && ++i < l) n /= 1000

	i = i >= l ? l - 1 : i
	n = round(n, decimals)

	return retObj ? { v: n, s: s[i] } : n + s[i]
}

export function humanizeDuration(seconds) {
	seconds = parseInt(seconds, 10)

	const days = Math.floor(seconds / 86400)
	seconds -= days * 86400

	const hours = Math.floor(seconds / 3600)
	seconds -= hours * 3600

	const minutes = Math.floor(seconds / 60)
	seconds -= minutes * 60

	const parts = [
		{ value: days, unit: 'd' },
		{ value: hours, unit: 'h' },
		{ value: minutes, unit: "'" },
		{ value: seconds, unit: "''" },
	]
	return parts
		.filter(({ value }) => value !== 0)
		.map(({ unit, value }) => value + unit)
		.join(' ')
}

export function downloadJSON(config, fileName) {
	const contentType = 'application/octet-stream'
	const a = document.createElement('a')
	const blob = new Blob([JSON.stringify(config)], { type: contentType })
	document.body.appendChild(a)
	a.href = window.URL.createObjectURL(blob)
	a.download = `${fileName}.json`
	a.target = '_self'
	a.click()
}

export function wait(ms) {
	return new Promise((r) => setTimeout(r, ms))
}

export function isObject(o) {
	return typeof o === 'object' && o !== null
}

// Does something like vue $set: https://github.com/vuejs/vue/blob/edf7df0c837557dd3ea8d7b42ad8d4b21858ade0/dist/vue.common.dev.js#L1058
export function $set(o, p, v) {
	return Object.assign(o, { [p]: v })
}

export function formatBytes(bytes, decimals = 2) {
	if (!bytes || bytes === 0) return '0 Bytes'

	const k = 1024
	const dm = decimals < 0 ? 0 : decimals
	const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']

	const i = Math.floor(Math.log(bytes) / Math.log(k))

	return `${parseFloat((bytes / k ** i).toFixed(dm))} ${sizes[i]}`
}

export function incrementalName(str) {
	if (!str) {
		return ''
	}
	// get last number portion
	let id = str.match(/\d+$/)
	id = id && parseInt(id[0], 10) >= 0 ? id[0] : -1
	return id >= 0 ? str.replace(id, parseInt(id, 10) + 1) : `${str}_1`
}

export function isNumber(value, coerce = false) {
	if (coerce) {
		value = Number(value)
	}
	return typeof value === 'number' && Number.isFinite(value)
}

export function parseDateRange(ranges) {
	return ranges
		? `${localDateOnly(ranges.start)} - ${localDateOnly(ranges.end)}`
		: ''
}

export function nearestMultipler(value, multipler) {
	return Math.round(value / multipler) * multipler
}

export function cutHex(str) {
	return str.charAt(0) === '#' ? str.substring(1, 7) : str
}

export function arrayEquals(arr1, arr2) {
	if (!(arr1 instanceof Array) || !(arr2 instanceof Array)) return false

	if (arr1.length !== arr2.length) return false

	for (let i = arr1.length; i--; ) {
		if (arr1[i] !== arr2[i]) return false
	}

	return true
}

export function binaryToInt(v) {
	const num = v.split('').reverse().join('')
	return parseInt(num, 2)
}

export function intToBinary(v, bit) {
	const binary =
		v.toString(2).length < bit
			? '0'.repeat(bit - v.toString(2).length) + v.toString(2)
			: v.toString(2)
	return binary.split('').reverse().join('')
}

export function noop() {}

export function prettyJson(v) {
	return JSON.stringify(v, null, 2)
}

export function setDefaults(obj, def) {
	for (const key in def) {
		if (obj[key] === undefined) {
			obj[key] = def[key]
		}
	}

	return obj
}
