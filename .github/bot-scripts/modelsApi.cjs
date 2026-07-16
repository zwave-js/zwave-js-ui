// @ts-check

// Shared helpers for calling the GitHub Models API

const API_BASE = "https://models.github.ai/inference";
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL
	|| "openai/text-embedding-3-small";
const CHAT_MODEL = process.env.CHAT_MODEL || "openai/gpt-4o";

const MAX_RETRIES = 5;

// Stay well below the 64K tokens/request limit for embedding requests
const MAX_BATCH_TOKENS = 40_000;
const MAX_BATCH_INPUTS = 128;
// The free tier allows 15 requests/minute
const THROTTLE_MS = 4500;

/** @param {string} str */
function estimateTokens(str) {
	return Math.ceil(str.length / 4);
}

/**
 * Performs a request against the Models API, retrying with backoff
 * on rate limits and transient server errors
 * @param {string} path
 * @param {object} body
 * @param {string} token
 * @returns {Promise<any>}
 */
async function modelsRequest(path, body, token) {
	for (let attempt = 0;; attempt++) {
		const response = await fetch(`${API_BASE}${path}`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${token}`,
			},
			body: JSON.stringify(body),
		});
		if (response.ok) return response.json();

		const retriable = response.status === 429 || response.status >= 500;
		if (!retriable || attempt >= MAX_RETRIES) {
			const text = await response.text().catch(() => "");
			throw new Error(
				`Models API request failed with status ${response.status}: ${text}`,
			);
		}

		// Honor Retry-After if present, otherwise back off exponentially
		const retryAfter = Number(response.headers.get("retry-after"));
		const delay = Number.isFinite(retryAfter) && retryAfter > 0
			? retryAfter * 1000
			: Math.min(60_000, 2 ** attempt * 5000);
		console.log(
			`Models API returned ${response.status}, retrying in ${
				Math.round(delay / 1000)
			}s...`,
		);
		await new Promise((resolve) => setTimeout(resolve, delay));
	}
}

/**
 * Embeds one or more texts, returning the embeddings in input order
 * @param {string[]} inputs
 * @param {string} token
 * @param {string} [model]
 * @returns {Promise<number[][]>}
 */
async function embed(inputs, token, model = EMBEDDING_MODEL) {
	const result = await modelsRequest("/embeddings", {
		model,
		input: inputs,
	}, token);
	return result.data
		.sort((/** @type {any} */ a, /** @type {any} */ b) => a.index - b.index)
		.map((/** @type {any} */ d) => d.embedding);
}

/**
 * Embeds texts destined for an index, batching them within the
 * per-request limits and throttling between requests.
 * @param {string[]} texts
 * @param {string} token
 * @param {string} [model]
 * @returns {Promise<number[][]>} Embeddings in input order
 */
async function embedBatched(texts, token, model = EMBEDDING_MODEL) {
	/** @type {number[][]} */
	const results = [];
	let cursor = 0;
	let requestCount = 0;
	while (cursor < texts.length) {
		const batch = [];
		let batchTokens = 0;
		while (cursor < texts.length && batch.length < MAX_BATCH_INPUTS) {
			const tokens = estimateTokens(texts[cursor]);
			if (batch.length > 0 && batchTokens + tokens > MAX_BATCH_TOKENS) {
				break;
			}
			batch.push(texts[cursor]);
			batchTokens += tokens;
			cursor++;
		}

		if (requestCount > 0) {
			await new Promise((resolve) => setTimeout(resolve, THROTTLE_MS));
		}
		console.log(
			`Embedding batch of ${batch.length} texts (~${batchTokens} tokens)...`,
		);
		const embeddings = await embed(batch, token, model);
		requestCount++;
		results.push(
			// Round to reduce index size, this has no measurable impact on similarity
			...embeddings.map((embedding) =>
				embedding.map((x) => Math.round(x * 1e5) / 1e5)
			),
		);
	}
	console.log(`Done, used ${requestCount} embedding requests`);
	return results;
}

module.exports = {
	modelsRequest,
	embed,
	embedBatched,
	EMBEDDING_MODEL,
	CHAT_MODEL,
};
