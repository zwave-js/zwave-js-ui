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
			// Glob-scoped thresholds (matched against each covered file's path,
			// independently of the top-level `lines`/`statements`/etc. keys,
			// which aren't set here) let this single, full-repo `npm run
			// coverage` run double as backend-only threshold enforcement.
			// This avoids running the backend test suite a second time in CI
			// just to check its coverage (`coverage:server` is a local-only
			// convenience script, not part of the CI pipeline); running
			// backend tests once, in the full combined run, is enough to both
			// enforce the thresholds below AND produce the file-level line
			// data Coveralls needs for `api/**`.
			//
			// `'api/runtime/**'` and `'api/routes/**'` are independently
			// -accumulated glob groups (a file under `api/routes/` counts
			// toward both groups' own coverage maps - see the coverage v8
			// provider's `resolveThresholds()`), enforcing a stricter bar for
			// the runtime/HTTP-router extraction
			// (`refactor(api): extract runtime and http routers`) than the
			// rest of the codebase.
			thresholds: {
				'api/runtime/**': {
					statements: 90,
					branches: 85,
					functions: 90,
					lines: 90,
				},
				'api/routes/**': {
					statements: 90,
					branches: 85,
					functions: 90,
					lines: 90,
				},
			},
		},
	},
})
