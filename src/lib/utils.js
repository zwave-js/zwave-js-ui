export function copy(o) {
	return JSON.parse(JSON.stringify(o))
}

export function wait(ms) {
	return new Promise((r) => setTimeout(r, ms))
}

export function parseSecurityClasses(securityClasses, defaultVal) {
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
	return /^(\d{5}-){7}\d{5}$/.test(dsk) || 'Code not valid'
}

// Does something like vue $set: https://github.com/vuejs/vue/blob/edf7df0c837557dd3ea8d7b42ad8d4b21858ade0/dist/vue.common.dev.js#L1058
export function $set(o, p, v) {
	return Object.assign(o, { [p]: v })
}

export function jsonToList(obj) {
	let s = ''
	for (const k in obj) s += k + ': ' + obj[k] + '\n'

	return s
}
