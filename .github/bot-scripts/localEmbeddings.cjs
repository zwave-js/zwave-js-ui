// @ts-check

// Local embedding pipeline running on the CI runner, replacing the
// retired GitHub Models embeddings API

const { homedir } = require("node:os");
const { join } = require("node:path");

// Keep model, revision and dtype in sync with the zwave-js repository
// (.github/bot-scripts/localEmbeddings.cjs there), so evals and answer
// quality stay comparable between the two bots
const EMBEDDING_MODEL = "Xenova/all-MiniLM-L6-v2";
const MODEL_REVISION = "751bff37182d3f1213fa05d7196b954e230abad9";
// q8 quantization quarters the download and memory footprint; the
// retrieval evals showed no quality loss against the full weights
const MODEL_DTYPE = "q8";

// CI cache key for the model weights: changes exactly when different
// weights would be downloaded, so unrelated edits to this file don't
// evict the cache. Consumed by .github/actions/setup-bot-embeddings.
const MODEL_CACHE_KEY = `${EMBEDDING_MODEL}@${MODEL_REVISION}@${MODEL_DTYPE}`
	.replaceAll("/", "_");

// Process a bounded number of texts per pipeline call to limit peak memory
const BATCH_SIZE = 32;

function defaultModelCacheDir() {
	const xdg = process.env.XDG_CACHE_HOME;
	const base = xdg && xdg.trim().length > 0
		? xdg
		: join(homedir(), ".cache");
	return join(base, "zwave-js-ui-bot", "models");
}

/** @type {Promise<any> | undefined} */
let extractorPromise;

async function createExtractor() {
	// The package is ESM-only, hence the dynamic import
	const { pipeline } = await import("@huggingface/transformers");
	// A cache miss downloads the weights from huggingface.co. Retry with
	// backoff so a hiccup there does not fail a user-triggered run.
	let lastError;
	for (let attempt = 1; attempt <= 3; attempt++) {
		try {
			return await pipeline("feature-extraction", EMBEDDING_MODEL, {
				cache_dir: process.env.BOT_MODEL_CACHE_DIR?.trim()
					|| defaultModelCacheDir(),
				revision: MODEL_REVISION,
				dtype: MODEL_DTYPE,
			});
		} catch (e) {
			lastError = e;
			console.log(
				`::warning::Loading the embedding model failed (attempt ${attempt}/3): ${e.message}`,
			);
			await new Promise((resolve) =>
				setTimeout(resolve, attempt * 5000)
			);
		}
	}
	throw new Error(
		`Could not load the embedding model ${EMBEDDING_MODEL}: ${lastError.message}`,
		{ cause: lastError },
	);
}

function getExtractor() {
	extractorPromise ??= createExtractor();
	return extractorPromise;
}

/**
 * Substitutes the feature-extraction pipeline, so tests exercise the
 * embedding code without downloading the model. The bot scripts pull each
 * other in through native `require`, which module mocking cannot intercept.
 * @param {((batch: string[], options: any) => Promise<any>) | undefined} extractor
 */
function setExtractor(extractor) {
	extractorPromise = extractor && Promise.resolve(extractor);
}

/**
 * Embeds one or more texts, returning the embeddings in input order
 * @param {string[]} inputs
 * @returns {Promise<number[][]>}
 */
async function embed(inputs) {
	if (inputs.length === 0) return [];
	const extractor = await getExtractor();

	// Each batch is padded to its longest member, so batch texts of
	// similar length together and restore the input order afterwards
	const order = inputs
		.map((_, i) => i)
		.sort((a, b) => inputs[a].length - inputs[b].length);

	/** @type {number[][]} */
	const results = new Array(inputs.length);
	let done = 0;
	for (let i = 0; i < order.length; i += BATCH_SIZE) {
		const batchOrder = order.slice(i, i + BATCH_SIZE);
		const output = await extractor(
			batchOrder.map((j) => inputs[j]),
			{
				pooling: "mean",
				normalize: true,
			},
		);
		// dims is [batch, hidden]; anything else means the pipeline
		// changed shape, and flattening it blindly would push corrupted
		// vectors into the index
		if (output.dims?.length !== 2) {
			throw new Error(
				`Unexpected embedding tensor shape [${output.dims}]`,
			);
		}
		const vectors = output.tolist();
		batchOrder.forEach((j, k) => results[j] = vectors[k]);
		done += batchOrder.length;
		// Index builds run for minutes; leave evidence of progress in
		// case the job hits its timeout
		if (inputs.length > BATCH_SIZE) {
			console.log(`Embedded ${done}/${inputs.length} texts`);
		}
	}
	return results;
}

/**
 * Embeds texts destined for an index
 * @param {string[]} texts
 * @returns {Promise<number[][]>} Embeddings in input order
 */
async function embedBatched(texts) {
	console.log(`Embedding ${texts.length} texts locally...`);
	const embeddings = await embed(texts);
	// Round to reduce index size, this has no measurable impact on similarity
	return embeddings.map((embedding) =>
		embedding.map((x) => Math.round(x * 1e5) / 1e5)
	);
}

/**
 * Checks that an index was embedded with the pinned model, so its
 * similarities are comparable to freshly embedded questions. Emits a
 * workflow warning on mismatch, so a skipped index shows up in the run
 * annotations instead of only in the log.
 * @param {{model?: string} | undefined} index
 * @param {string} description
 */
function indexMatchesModel(index, description) {
	if (!index) return false;
	if (index.model === EMBEDDING_MODEL) return true;
	console.log(
		`::warning::The ${description} was created with ${index.model}, not ${EMBEDDING_MODEL} - ignoring it until it is rebuilt`,
	);
	return false;
}

module.exports = {
	embed,
	embedBatched,
	indexMatchesModel,
	setExtractor,
	EMBEDDING_MODEL,
	MODEL_CACHE_KEY,
};
