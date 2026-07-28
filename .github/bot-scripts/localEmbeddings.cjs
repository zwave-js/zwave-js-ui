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

function getExtractor() {
	extractorPromise ??= (async () => {
		// The package is ESM-only, hence the dynamic import
		const { pipeline } = await import("@huggingface/transformers");
		return pipeline("feature-extraction", EMBEDDING_MODEL, {
			cache_dir: process.env.BOT_MODEL_CACHE_DIR?.trim()
				|| defaultModelCacheDir(),
			revision: MODEL_REVISION,
			dtype: "q8",
		});
	})();
	return extractorPromise;
}

/**
 * Embeds one or more texts, returning the embeddings in input order
 * @param {string[]} inputs
 * @returns {Promise<number[][]>}
 */
async function embed(inputs) {
	if (inputs.length === 0) return [];
	const extractor = await getExtractor();

	/** @type {number[][]} */
	const results = [];
	for (let i = 0; i < inputs.length; i += BATCH_SIZE) {
		const batch = inputs.slice(i, i + BATCH_SIZE);
		const output = await extractor(batch, {
			pooling: "mean",
			normalize: true,
		});
		const data = output.tolist();
		results.push(...(Array.isArray(data[0]) ? data : [data]));
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

module.exports = {
	embed,
	embedBatched,
	EMBEDDING_MODEL,
};
