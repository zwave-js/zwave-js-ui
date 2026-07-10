import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Backend-only Vitest config, used by `npm run coverage:server`.
 *
 * Unlike the root `vitest.config.ts` (which reports combined `api/**` +
 * `src/**` coverage across the whole suite), this config:
 *  - only runs the backend suite (`test/lib/**`, no `src/**` frontend tests)
 *  - only reports coverage for `api/**`
 *  - enforces coverage thresholds, so backend coverage can only ratchet up
 *
 * Thresholds are set to the coverage this repo's backend suite actually
 * reaches as of the HTTP-contract characterization PR (test(api):
 * characterize HTTP compatibility) - not an arbitrary target. Bump these
 * numbers (never lower them) whenever a PR meaningfully raises backend
 * coverage.
 */
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
		],
	},
	test: {
		environment: 'node',
		include: ['test/lib/**/*.test.ts'],
		coverage: {
			provider: 'v8',
			all: true,
			reporter: ['text', 'lcov'],
			reportsDirectory: './coverage-server',
			include: ['api/**'],
			exclude: ['**/*.test.*', 'test/**'],
			thresholds: {
				statements: 19,
				branches: 14,
				functions: 23,
				lines: 19,
			},
		},
	},
})
