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
			// Report every file matched by `include`, not just those imported by
			// a test, so untested files count against coverage (matches the old
			// `c8 --all` behaviour and keeps the Coveralls report honest).
			all: true,
			reporter: ['text', 'lcov'],
			reportsDirectory: './coverage',
			include: ['api/**/*.{js,ts}', 'src/**/*.{js,ts}'],
			exclude: ['**/*.test.*', 'test/**'],
			// Exact-file threshold keys are checked independently of each other, so one full-repo run also enforces a stricter bar for the extracted runtime/router files without a separate backend-only coverage run
			// Running backend tests once here also produces the file-level api/** line data Coveralls needs
			thresholds: {
				'api/runtime/AppRuntime.ts': {
					statements: 90,
					branches: 85,
					functions: 90,
					lines: 90,
				},
				'api/routes/auth.ts': {
					statements: 90,
					branches: 85,
					functions: 90,
					lines: 90,
				},
				'api/routes/configurationTemplates.ts': {
					statements: 90,
					branches: 85,
					functions: 90,
					lines: 90,
				},
				'api/routes/debug.ts': {
					statements: 90,
					branches: 85,
					functions: 90,
					lines: 90,
				},
				'api/routes/health.ts': {
					statements: 90,
					branches: 85,
					functions: 90,
					lines: 90,
				},
				'api/routes/importExport.ts': {
					statements: 90,
					branches: 85,
					functions: 90,
					lines: 90,
				},
				'api/routes/settings.ts': {
					statements: 90,
					branches: 85,
					functions: 90,
					lines: 90,
				},
				'api/routes/store.ts': {
					statements: 90,
					branches: 85,
					functions: 90,
					lines: 90,
				},
			},
		},
	},
})
