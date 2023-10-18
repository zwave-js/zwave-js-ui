'use strict'

const { register } = require('esbuild-register/dist/node')

register({
	hookMatcher(f) {
		return f.endsWith('.ts')
	},
	// Prevent esbuild from adding a "2" to the names of CC classes for some reason.
	keepNames: true,
	// Target the correct node version in transpilation
	target: `node${process.versions.node}`,
	// Stick to legacy decorators for now
	tsconfigRaw: {
		compilerOptions: {
			experimentalDecorators: true,
		},
	},
})
