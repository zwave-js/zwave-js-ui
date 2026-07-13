/**
 * Environment bootstrap for the HASS characterization suite, layered on the
 * shared transport suite's isolated `STORE_DIR` setup.
 *
 * `Gateway.ts` installs real `fs.watch()` watchers under `storeDir` at
 * module-evaluation time and `api/config/app.ts` computes `storeDir` once at
 * first import, so any dynamic import of `Gateway.ts` before `ensureTestEnv()`
 * would permanently bind these modules to the real `store/` directory.
 *
 * The HASS modules also read three env vars the transport suites don't
 * (`HASS_ENV_VARS`): `UID_DISCOVERY_PREFIX` (a module-level const in
 * `Gateway.ts`, so it must be cleared before import),
 * `DISCOVERY_DISABLE_CC_CONFIGURATION`, and `MQTT_NAME`. `ensureTestEnv()`
 * snapshots and clears them before delegating; `cleanupTestEnv()` restores
 * them, so ambient values can't leak in or out.
 */
import {
	ensureTestEnv as ensureSharedTestEnv,
	cleanupTestEnv as cleanupSharedTestEnv,
	TEST_SESSION_SECRET,
} from '../shared/env.ts'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Env vars the HASS discovery modules read, snapshotted and cleared before any
 * HASS module imports so an ambient value can't repoint a discovery prefix,
 * disable Configuration-CC discovery, or rewrite the MQTT client id.
 */
const HASS_ENV_VARS = [
	'UID_DISCOVERY_PREFIX',
	'DISCOVERY_DISABLE_CC_CONFIGURATION',
	'MQTT_NAME',
] as const

let hassEnvSnapshot: Record<string, string | undefined> | undefined

const repositoryStoreDir = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	'../../../store',
)

export interface RepositoryStoreArtifact {
	path: string
	type: 'directory' | 'file'
	content?: string
}

export function snapshotRepositoryStore(): RepositoryStoreArtifact[] {
	if (!fs.existsSync(repositoryStoreDir)) return []

	const artifacts: RepositoryStoreArtifact[] = []
	const visit = (directory: string): void => {
		for (const entry of fs
			.readdirSync(directory, { withFileTypes: true })
			.sort((left, right) => left.name.localeCompare(right.name))) {
			const absolutePath = path.join(directory, entry.name)
			const relativePath = path.relative(repositoryStoreDir, absolutePath)
			if (entry.isDirectory()) {
				artifacts.push({ path: relativePath, type: 'directory' })
				visit(absolutePath)
			} else {
				artifacts.push({
					path: relativePath,
					type: 'file',
					content: fs.readFileSync(absolutePath).toString('base64'),
				})
			}
		}
	}
	visit(repositoryStoreDir)
	return artifacts
}

// Exempt logger-owned roots because logger.test.ts writes them concurrently in the repository store
const CONCURRENT_TEST_ARTIFACT_ROOTS = new Set(['.session-secret', 'logs'])

function isConcurrentTestArtifact(artifactPath: string): boolean {
	return CONCURRENT_TEST_ARTIFACT_ROOTS.has(artifactPath.split(path.sep)[0])
}

export function unexpectedRepositoryStoreDrift(
	before: RepositoryStoreArtifact[],
	after: RepositoryStoreArtifact[],
): RepositoryStoreArtifact[] {
	const beforeByPath = new Map(
		before.map((artifact) => [artifact.path, artifact]),
	)
	return after.filter((artifact) => {
		const prior = beforeByPath.get(artifact.path)
		const changed =
			!prior ||
			prior.type !== artifact.type ||
			prior.content !== artifact.content
		return changed && !isConcurrentTestArtifact(artifact.path)
	})
}

export function missingRepositoryStoreArtifacts(
	before: RepositoryStoreArtifact[],
	after: RepositoryStoreArtifact[],
): RepositoryStoreArtifact[] {
	const afterPaths = new Set(after.map((artifact) => artifact.path))
	return before.filter(
		(artifact) =>
			!afterPaths.has(artifact.path) &&
			!isConcurrentTestArtifact(artifact.path),
	)
}

/**
 * Snapshot and clear the HASS env vars, then delegate to the shared harness's
 * `ensureTestEnv()`. Clearing happens first, before any caller imports
 * `Gateway.ts`, so its module-level `UID_DISCOVERY_PREFIX` sees the cleared
 * default. Idempotent; returns the isolated store dir.
 */
export function ensureTestEnv(): string {
	if (!hassEnvSnapshot) {
		hassEnvSnapshot = {}
		for (const key of HASS_ENV_VARS) {
			hassEnvSnapshot[key] = process.env[key]
			delete process.env[key]
		}
	}
	return ensureSharedTestEnv()
}

export function getTestStoreDir(): string {
	return ensureTestEnv()
}

/**
 * Restore the shared-suite env and each `HASS_ENV_VARS` entry to its
 * pre-`ensureTestEnv()` value (or remove it), so nothing leaks into whatever
 * runs next.
 */
export function cleanupTestEnv(): void {
	cleanupSharedTestEnv()
	if (hassEnvSnapshot) {
		for (const key of HASS_ENV_VARS) {
			const original = hassEnvSnapshot[key]
			if (original === undefined) {
				delete process.env[key]
			} else {
				process.env[key] = original
			}
		}
		hassEnvSnapshot = undefined
	}
}

export { TEST_SESSION_SECRET }
