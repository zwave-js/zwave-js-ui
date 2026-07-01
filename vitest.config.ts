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
				replacement: `${path.resolve(__dirname, 'api')}/$1`,
			},
		],
	},
	test: {
		environment: 'node',
		include: ['src/**/*.test.{js,ts}', 'test/**/*.test.ts'],
		coverage: {
			provider: 'v8',
			// Report every file matched by `include`, not just those imported by
			// a test, so untested files count against coverage (matches the old
			// `c8 --all` behaviour and keeps the Coveralls report honest).
			all: true,
			reporter: ['text', 'lcov'],
			reportsDirectory: './coverage',
			include: ['api/**', 'src/**'],
			exclude: ['**/*.test.*', 'test/**'],
		},
	},
})
