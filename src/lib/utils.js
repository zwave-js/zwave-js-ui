export function copy(o) {
	return JSON.parse(JSON.stringify(o))
}

export function wait(ms) {
	return new Promise((r) => setTimeout(r, ms))
}
