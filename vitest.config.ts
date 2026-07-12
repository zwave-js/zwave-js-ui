import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Dedicated Vitest config. The app build pipeline (Vue/Vuetify/PWA plugins)
// lives in vite.config.mjs; the current test suites exercise plain JS/TS
// modules and don't need those plugins, so this config stays minimal and fast.
// Add a `projects` entry with the Vue plugin + jsdom here if/when component
// tests are introduced.
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
