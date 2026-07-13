// Re-exports the HTTP suite's env isolation so both transports share one STORE_DIR/dotenv implementation
// Vitest isolates modules per test file, so this shared code still gives each test file its own independent storeDir/envSnapshot
export {
	ensureTestEnv,
	getTestStoreDir,
	cleanupTestEnv,
	TEST_SESSION_SECRET,
} from '../http/env.ts'
