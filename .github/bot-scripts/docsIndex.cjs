// @ts-check

// Hybrid retrieval over the pre-built docs embeddings index:
// dense embeddings catch paraphrased questions, BM25 catches exact
// tokens like API names and error codes. Both rankings are fused
// via Reciprocal Rank Fusion.

const fs = require("node:fs/promises");

// Bump whenever the index shape or chunking logic changes incompatibly,
// so stale caches are rebuilt instead of being (mis)used as-is.
const DOCS_INDEX_VERSION = 1;

/**
 * Checks that a chunk has the shape produced by buildDocsIndex.cjs and
 * expected by retrieve(), guarding against a corrupted or hand-edited index
 * @param {any} chunk
 */
function isValidChunk(chunk) {
	return (
		!!chunk
		&& typeof chunk === "object"
		&& typeof chunk.file === "string"
		&& typeof chunk.anchor === "string"
		&& typeof chunk.title === "string"
		&& Array.isArray(chunk.breadcrumbs)
		&& chunk.breadcrumbs.every(
			(/** @type {any} */ b) => typeof b === "string",
		)
		&& typeof chunk.text === "string"
		&& Array.isArray(chunk.embedding)
		&& chunk.embedding.length > 0
		&& chunk.embedding.every(
			(/** @type {any} */ value) =>
				typeof value === "number" && Number.isFinite(value),
		)
		&& chunk.embedding.some(
			(/** @type {number} */ value) => value !== 0,
		)
	);
}

/**
 * Loads and validates the docs embeddings index, returning undefined if
 * it is missing, of an incompatible version, or malformed, so callers
 * can degrade gracefully instead of retrieving against garbage data
 * @param {string | undefined} path
 * @returns {Promise<{version: number, model: string, createdAt: string, chunks: any[]} | undefined>}
 */
async function loadDocsIndex(path) {
	if (!path) return undefined;
	try {
		const index = JSON.parse(await fs.readFile(path, "utf8"));
		if (
			!index
			|| index.version !== DOCS_INDEX_VERSION
			|| typeof index.model !== "string"
			|| !Array.isArray(index.chunks)
			|| !index.chunks.every(isValidChunk)
			|| (
				index.chunks.length > 0
				&& !index.chunks.every(
					(/** @type {any} */ chunk) =>
						chunk.embedding.length
							=== index.chunks[0].embedding.length,
				)
			)
		) {
			return undefined;
		}
		return index;
	} catch {
		return undefined;
	}
}

/**
 * @param {number[]} a
 * @param {number[]} b
 */
function cosineSimilarity(a, b) {
	let dot = 0;
	let normA = 0;
	let normB = 0;
	for (let i = 0; i < a.length; i++) {
		dot += a[i] * b[i];
		normA += a[i] * a[i];
		normB += b[i] * b[i];
	}
	return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/** @param {string} text */
function tokenize(text) {
	return text
		.toLowerCase()
		.split(/[^a-z0-9]+/)
		.filter((t) => t.length >= 2);
}

// Corpus statistics are query-independent, so they are computed once
// per index and reused across queries (the evals query in a loop)
/** @type {WeakMap<object, ReturnType<typeof computeBm25Stats>>} */
const bm25StatsCache = new WeakMap();

/** @param {{text: string, breadcrumbs: string[]}[]} chunks */
function computeBm25Stats(chunks) {
	const docs = chunks.map((chunk) =>
		tokenize(chunk.breadcrumbs.join(" ") + " " + chunk.text)
	);
	const avgLength = docs.reduce((sum, d) => sum + d.length, 0)
		/ docs.length;

	/** @type {Map<string, number>} */
	const docFrequency = new Map();
	const termFrequencies = docs.map((tokens) => {
		/** @type {Map<string, number>} */
		const tf = new Map();
		for (const token of tokens) tf.set(token, (tf.get(token) ?? 0) + 1);
		for (const token of tf.keys()) {
			docFrequency.set(token, (docFrequency.get(token) ?? 0) + 1);
		}
		return tf;
	});

	return { docs, avgLength, docFrequency, termFrequencies };
}

/**
 * Computes BM25 scores for all chunks against the query
 * @param {{text: string, breadcrumbs: string[]}[]} chunks
 * @param {string[]} queryTokens
 * @returns {number[]}
 */
function bm25Scores(chunks, queryTokens) {
	const k1 = 1.2;
	const b = 0.75;

	let stats = bm25StatsCache.get(chunks);
	if (!stats) {
		stats = computeBm25Stats(chunks);
		bm25StatsCache.set(chunks, stats);
	}
	const { docs, avgLength, docFrequency, termFrequencies } = stats;

	const uniqueQueryTokens = [...new Set(queryTokens)];
	return docs.map((tokens, i) => {
		let score = 0;
		for (const token of uniqueQueryTokens) {
			const df = docFrequency.get(token);
			if (!df) continue;
			const tf = termFrequencies[i].get(token) ?? 0;
			if (!tf) continue;
			const idf = Math.log(
				(docs.length - df + 0.5) / (df + 0.5) + 1,
			);
			score += idf
				* (tf * (k1 + 1))
				/ (tf + k1 * (1 - b + b * tokens.length / avgLength));
		}
		return score;
	});
}

/**
 * Fuses multiple rankings using Reciprocal Rank Fusion
 * @param {number[][]} rankings Arrays of chunk indices, best first
 * @returns {number[]} Fused ranking of chunk indices, best first
 */
function reciprocalRankFusion(rankings) {
	/** @type {Map<number, number>} */
	const scores = new Map();
	for (const ranking of rankings) {
		ranking.forEach((chunkIndex, rank) => {
			scores.set(
				chunkIndex,
				(scores.get(chunkIndex) ?? 0) + 1 / (60 + rank),
			);
		});
	}
	return [...scores.entries()]
		.sort((a, b) => b[1] - a[1])
		.map(([chunkIndex]) => chunkIndex);
}

/**
 * Retrieves the most relevant chunks for a question using hybrid search
 * @param {{chunks: any[]}} index The docs embeddings index
 * @param {number[]} questionEmbedding Embedding of the question text
 * @param {string} questionText The question text (for lexical search)
 * @param {number} numResults How many chunks to return
 * @returns {{results: {chunk: any, similarity: number, lexical: number}[], bestSimilarity: number}}
 */
function retrieve(index, questionEmbedding, questionText, numResults) {
	const similarities = index.chunks.map((chunk) =>
		cosineSimilarity(questionEmbedding, chunk.embedding)
	);
	const denseRanking = similarities
		.map((similarity, i) => [i, similarity])
		.sort((a, b) => b[1] - a[1])
		.slice(0, numResults * 2)
		.map(([i]) => i);
	const bestSimilarity = similarities[denseRanking[0]] ?? 0;

	const lexicalScores = bm25Scores(index.chunks, tokenize(questionText));
	const lexicalRanking = lexicalScores
		.map((score, i) => [i, score])
		.filter(([, score]) => score > 0)
		.sort((a, b) => b[1] - a[1])
		.slice(0, numResults * 2)
		.map(([i]) => i);

	const results = reciprocalRankFusion([denseRanking, lexicalRanking])
		.slice(0, numResults)
		.map((i) => ({
			chunk: index.chunks[i],
			similarity: similarities[i],
			lexical: lexicalScores[i],
		}));

	return { results, bestSimilarity };
}

module.exports = {
	DOCS_INDEX_VERSION,
	isValidChunk,
	loadDocsIndex,
	cosineSimilarity,
	retrieve,
};
