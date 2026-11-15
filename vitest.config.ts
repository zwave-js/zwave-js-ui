import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Keep tests separate from Vue/Vuetify/PWA build plugins because current suites exercise plain JS/TS modules
export default defineConfig({
	resolve: {
		alias: [
			{
				find: /^@\/(.+)/,
				replacement: `${path.resolve(__dirname, 'src')}/$1`,
			},
			{
				find: /^@server\/(.+)/,
				replacement: `${path.resolve(__dirname, 'server')}/$1`,
			},
			{
				// Keep source-only test imports out of the published package map
				find: /^#api\/(.+)/,
				replacement: `${path.resolve(__dirname, 'api')}/$1`,
			},
		],
	},
	test: {
		environment: 'node',
		include: [
			'src/**/*.test.{js,ts}',
			'test/**/*.test.ts',
			'.github/bot-scripts/**/*.test.cjs',
		],
		sequence: {
			// Run suite cleanup before shared harness teardown because cleanup may still access the active instance
			hooks: 'stack',
		},
		coverage: {
			provider: 'v8',
			// With Vitest 4's v8 provider, explicit `coverage.include` also adds
			// matching files that tests never import, so they count as uncovered.
			reporter: ['text', 'lcov'],
			reportsDirectory: './coverage',
			include: ['api/**/*.{js,ts}', 'src/**/*.{js,ts}'],
			exclude: ['**/*.test.*', 'test/**'],
		},
	},
})
