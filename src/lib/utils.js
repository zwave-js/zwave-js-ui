export function copy(o) {
	return JSON.parse(JSON.stringify(o))
}

export function wait(ms) {
	return new Promise((r) => setTimeout(r, ms))
}

export function parseSecurityClasses(securityClasses) {
	const classes = {
		s2AccessControl: false,
		s2Authenticated: false,
		s2Unhauntenticated: false,
		s0Legacy: false,
	}

	for (const c of securityClasses) {
		switch (c) {
			case 0:
				classes.s2Unhauntenticated = true
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
				case 's2Unhauntenticated':
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
