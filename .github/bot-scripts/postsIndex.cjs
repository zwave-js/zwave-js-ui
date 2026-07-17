// @ts-check

// Shared logic for the posts embeddings index: an index over GitHub
// issues and discussions used to suggest related/duplicate posts.
// The index is built nightly by buildPostsIndex.cjs and updated
// incrementally by updatePostsIndex.cjs when new posts arrive.

const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const { cosineSimilarity } = require("./docsIndex.cjs");

const POSTS_INDEX_VERSION = 1;

// Discussion categories where questions are expected
const QUESTION_CATEGORY_SLUGS = ["q-a"];

// Limit the post size to keep prompt and embedding within the token budget
const MAX_QUESTION_LENGTH = 6000;

/**
 * Reduces template boilerplate and log/code dumps in the post body,
 * which would otherwise dilute the query used for retrieval.
 * This produces the exact text that gets embedded for a post, so queries
 * against the index MUST be cleaned the same way for similarities to be
 * comparable.
 * @param {string} title
 * @param {string} body
 */
function cleanQuestion(title, body) {
	// Template instructions are hidden in HTML comments.
	// Replacements can create new comment sequences, repeat until stable.
	let text = body;
	let previous;
	do {
		previous = text;
		text = text.replace(/<!--[\s\S]*?-->/g, "");
	} while (text !== previous);

	text = text
		// Checked/unchecked checklist items carry no information
		.replace(/^\s*-\s*\[[ xX]\].*$/gm, "")
		// Retrieval matches on prose, not logs. Long code blocks would
		// dilute the embedding and blow the question length budget, so
		// they are shortened to head + tail. This is NOT log analysis -
		// that is the log analyzer's job, this bot only matches the
		// question against the documentation and existing posts.
		.replace(/(```|~~~)[\s\S]*?\1/g, (block) => {
			const lines = block.split("\n");
			if (lines.length <= 15) return block;
			return [
				...lines.slice(0, 8),
				"...",
				...lines.slice(-4),
			].join("\n");
		})
		.replace(/\n{3,}/g, "\n\n")
		.trim();
	return `${title}\n\n${text}`.slice(0, MAX_QUESTION_LENGTH);
}

/** @param {string} embeddedText */
function hashPost(embeddedText) {
	return crypto.createHash("sha256").update(embeddedText).digest("hex");
}

/**
 * @typedef {{
 *   type: "issue" | "discussion",
 *   number: number,
 *   title: string,
 *   url: string,
 *   state: "open" | "closed" | "answered",
 *   createdAt: string,
 *   closedAt: string | null,
 *   labels: string[],
 *   hash: string,
 *   embedding: number[],
 * }} IndexedPost
 */

/**
 * Loads and validates a posts index, returning undefined if it is
 * missing or incompatible so callers can degrade gracefully
 * @param {string | undefined} path
 * @returns {Promise<{version: number, model: string, createdAt: string, posts: IndexedPost[]} | undefined>}
 */
async function loadPostsIndex(path) {
	if (!path) return undefined;
	try {
		const index = JSON.parse(await fs.readFile(path, "utf8"));
		if (
			index.version !== POSTS_INDEX_VERSION
			|| !Array.isArray(index.posts)
		) {
			return undefined;
		}
		return index;
	} catch {
		return undefined;
	}
}

/**
 * Ranks indexed posts by similarity to the given embedding
 * @param {{posts: IndexedPost[]}} index
 * @param {number[]} questionEmbedding
 * @param {{type: string, number: number}} self The post being triaged, excluded from results
 * @param {{minSimilarity: number, maxResults: number}} options
 * @returns {{post: IndexedPost, similarity: number}[]} Most similar first
 */
function rankRelatedPosts(index, questionEmbedding, self, options) {
	return index.posts
		.filter(
			(post) => post.type !== self.type || post.number !== self.number,
		)
		.map((post) => ({
			post,
			similarity: cosineSimilarity(questionEmbedding, post.embedding),
		}))
		.filter(({ similarity }) => similarity >= options.minSimilarity)
		.sort((a, b) => b.similarity - a.similarity)
		.slice(0, options.maxResults);
}

module.exports = {
	POSTS_INDEX_VERSION,
	QUESTION_CATEGORY_SLUGS,
	cleanQuestion,
	hashPost,
	loadPostsIndex,
	rankRelatedPosts,
};
