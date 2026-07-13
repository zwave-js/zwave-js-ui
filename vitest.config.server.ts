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
 * reaches as of the Home Assistant integration characterization PR
 * (test(hass): characterize home assistant integrations, dependent on the
 * websocket- and HTTP-contract characterization PRs). That suite adds real
 * `Gateway`/`MqttClient`/`ZwaveClient` HASS-discovery, MQTT-lifecycle,
 * persistence, custom-device and official-`@zwave-js/server` coverage under
 * `test/lib/hass/*.test.ts`, which is what most recently raised these
 * numbers - not an arbitrary target. Bump these numbers (never lower them)
 * whenever a PR meaningfully raises backend coverage.
 *
 * `'api/runtime/AppRuntime.ts'`, each `'api/routes/*.ts'` file, and each
 * `'api/socket/*.ts'` file below are additional, independently-checked
 * EXACT-FILE threshold groups (see the coverage v8 provider's
 * `resolveThresholds()` - each key, whether a literal path or a glob,
 * accumulates its own coverage map from every file matching it, entirely
 * separate from the top-level global thresholds above and from each
 * other). The `api/routes/*.ts`/`api/runtime/AppRuntime.ts` entries cover
 * the runtime/HTTP-router extraction introduced by `refactor(api): extract
 * runtime and http routers`; the `api/socket/*.ts` entries cover the
 * Socket.IO handler extraction out of `api/app.ts`'s `setupSocket()`
 * (Layer 6 of issue #4722, `registerSocketApi.ts` + `zwaveApi.ts`/
 * `mqttApi.ts`/`hassApi.ts`/`znifferApi.ts`/`subscriptions.ts`/`types.ts`).
 * All are deliberately stricter than the repo-wide floor, so future changes
 * to any of these files can't silently erode ITS OWN coverage.
 *
 * These are exact file paths, not a `'api/routes/**'`/`'api/socket/**'`
 * glob, and `perFile` is NOT set: `perFile` is a single top-level boolean
 * the v8 provider applies uniformly to EVERY threshold group at once
 * (including the repo-wide 50/44/57/50 floor above, which most files don't
 * individually meet) - there is no way to scope it to just one group.
 * Enumerating every file as its own exact-match key is what actually
 * achieves independent per-file enforcement here: a coverage map built from
 * a single matched file equals that file's own summary, so each key below
 * is checked against that ONE file's real numbers, not a pooled average
 * across all of them. Add new files here as `api/runtime/**`/
 * `api/routes/**`/`api/socket/**` grow.
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
		include: ['test/lib/**/*.test.ts', 'test/runtime/**/*.test.ts'],
		coverage: {
			provider: 'v8',
			all: true,
			reporter: ['text', 'lcov'],
			reportsDirectory: './coverage-server',
			include: ['api/**'],
			exclude: ['**/*.test.*', 'test/**'],
			thresholds: {
				statements: 50,
				branches: 44,
				functions: 57,
				lines: 50,
				'api/hass/CustomDeviceRegistry.ts': {
					statements: 90,
					branches: 85,
					functions: 90,
					lines: 90,
				},
				'api/hass/DeviceStore.ts': {
					statements: 90,
					branches: 85,
					functions: 90,
					lines: 90,
				},
				'api/hass/DiscoveryGenerator.ts': {
					statements: 90,
					branches: 85,
					functions: 90,
					lines: 90,
				},
				'api/hass/ports.ts': {
					statements: 90,
					branches: 85,
					functions: 90,
					lines: 90,
				},
				'api/hass/types.ts': {
					statements: 90,
					branches: 85,
					functions: 90,
					lines: 90,
				},
				'api/hass/ZwaveServerManager.ts': {
					statements: 90,
					branches: 85,
					functions: 90,
					lines: 90,
				},
				'api/hass/MqttDiscoveryManager.ts': {
					statements: 90,
					branches: 85,
					functions: 90,
					lines: 90,
				},
				'api/hass/HomeAssistantManager.ts': {
					statements: 90,
					branches: 85,
					functions: 90,
					lines: 90,
				},
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
				'api/socket/hassApi.ts': {
					statements: 90,
					branches: 85,
					functions: 90,
					lines: 90,
				},
				'api/socket/mqttApi.ts': {
					statements: 90,
					branches: 85,
					functions: 90,
					lines: 90,
				},
				'api/socket/registerSocketApi.ts': {
					statements: 90,
					branches: 85,
					functions: 90,
					lines: 90,
				},
				'api/socket/subscriptions.ts': {
					statements: 90,
					branches: 85,
					functions: 90,
					lines: 90,
				},
				'api/socket/types.ts': {
					statements: 90,
					branches: 85,
					functions: 90,
					lines: 90,
				},
				'api/socket/znifferApi.ts': {
					statements: 90,
					branches: 85,
					functions: 90,
					lines: 90,
				},
				'api/socket/zwaveApi.ts': {
					statements: 90,
					branches: 85,
					functions: 90,
					lines: 90,
				},
				'api/lib/zwave/ScheduleService.ts': {
					statements: 90,
					branches: 85,
					functions: 90,
					lines: 90,
				},
				'api/lib/zwave/ConfigurationTemplateService.ts': {
					statements: 90,
					branches: 85,
					functions: 90,
					lines: 90,
				},
				'api/lib/zwave/SceneService.ts': {
					statements: 90,
					branches: 85,
					functions: 90,
					lines: 90,
				},
				'api/lib/zwave/GroupService.ts': {
					statements: 90,
					branches: 85,
					functions: 90,
					lines: 90,
				},
				'api/lib/zwave/AssociationService.ts': {
					statements: 90,
					branches: 85,
					functions: 90,
					lines: 90,
				},
				'api/lib/zwave/FirmwareUpdateService.ts': {
					statements: 90,
					branches: 85,
					functions: 90,
					lines: 90,
				},
				'api/lib/zwave/InclusionCoordinator.ts': {
					statements: 90,
					branches: 85,
					functions: 90,
					lines: 90,
				},
				'api/lib/zwave/DriverLifecycle.ts': {
					statements: 95,
					branches: 90,
					functions: 95,
					lines: 95,
				},
				// `ZwaveClient.ts` itself (~7,640 lines) is not held to the
				// 90/85/90/90 bar the extracted services above are - most of
				// it is driver-event-handler logic that would need a full
				// fake zwave-js `Driver`/`ZWaveNode` graph to reach honestly,
				// which `outboundProducers.test.ts`'s own doc comment
				// deliberately avoids fabricating. This is a real,
				// measured-then-locked non-regression floor for the wiring
				// `zwaveClientServiceWiring.test.ts` characterizes (PR
				// #4732 review finding #4): association delegates, the group
				// CRUD facade (the closure-backed virtual-node registry
				// finding #2 fixed), `_buildVirtualValueId`, startup group
				// restoration, node-removal group-index delegation, and
				// group virtual-node socket projection. Measured baseline
				// with that file's 20 tests: 22.81/17.02/31.14/22.91
				// (statements/branches/functions/lines) - without it:
				// 20.02/14.29/23.22/20.12. Numbers below are that measured
				// baseline with a small safety margin, never to be lowered;
				// bump them (never lower) whenever a PR meaningfully raises
				// `ZwaveClient.ts` coverage.
				'api/lib/ZwaveClient.ts': {
					statements: 29,
					branches: 20,
					functions: 39,
					lines: 29,
				},
			},
		},
	},
})
