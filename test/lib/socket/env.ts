// Re-exports the HTTP suite's env isolation so both transports share one STORE_DIR/dotenv implementation
export {
	ensureTestEnv,
	getTestStoreDir,
	cleanupTestEnv,
	TEST_SESSION_SECRET,
} from '../http/env.ts'
