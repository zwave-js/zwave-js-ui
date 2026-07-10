/**
 * Environment bootstrap for the Socket.IO contract suite.
 *
 * `api/app.ts` needs the exact same isolated `STORE_DIR` / normalized
 * env-var / mocked-`dotenv` setup the HTTP contract suite already built in
 * `test/lib/http/env.ts` (see that file's doc comment for the full
 * rationale) - the module being dynamically imported, and the ambient
 * process state it can leak from/into, are identical regardless of which
 * transport (HTTP routes vs Socket.IO events) a test then drives.
 *
 * Rather than duplicating that isolation logic (a second throwaway
 * `mkdtempSync` store dir, a second `APP_ENV_VARS` snapshot/restore, a
 * second `vi.mock('dotenv', ...)`), this module just re-exports it, so both
 * suites share one implementation and one behavioral contract. Vitest's
 * per-test-file module isolation means each test file (HTTP or socket)
 * still gets its own independent `storeDir`/`envSnapshot` - re-exporting
 * the functions doesn't share any of that mutable state across files, only
 * the code that manages it.
 */
export {
	ensureTestEnv,
	getTestStoreDir,
	cleanupTestEnv,
	TEST_SESSION_SECRET,
} from '../http/env.ts'
