// @ts-check
// Empty mock-server config used by the refresh-docs-screenshots skill.
// All "nodes" come from fakeNodes.seed.json — pure UI state, no real
// interview required. The mock-server here exists only so the driver
// can connect to *something* on tcp://127.0.0.1:5555 and reach
// "Driver is ready" in <5s.

/** @type {import('zwave-js/Testing').MockServerOptions['config']} */
module.exports.default = {
	nodes: [],
}
