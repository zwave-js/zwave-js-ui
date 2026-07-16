// @ts-check

/// <reference path="types.d.ts" />

// Incrementally adds a just-opened (or edited) issue or discussion to
// the posts embeddings index, so it can be suggested as a related post
// for questions arriving before the next nightly rebuild.

const fs = require("node:fs/promises");
const { embedBatched } = require("./modelsApi.cjs");
const {
	QUESTION_CATEGORY_SLUGS,
	cleanQuestion,
	hashPost,
	loadPostsIndex,
} = require("./postsIndex.cjs");

/**
 * Expects the following environment variables:
 * - MODELS_TOKEN: token with models:read permission
 * - POSTS_INDEX_PATH: path to the index created by buildPostsIndex.cjs
 *
 * @param {{github: Github, context: Context}} param
 * @returns {Promise<boolean>} Whether the index was modified
 */
async function main(param) {
	const { context } = param;

	const modelsToken = process.env.MODELS_TOKEN;
	if (!modelsToken) {
		console.log("No MODELS_TOKEN provided, skipping");
		return false;
	}

	const isDiscussion = !!context.payload.discussion;
	const post = context.payload.discussion ?? context.payload.issue;
	if (!post) {
		console.log("No issue or discussion in payload, skipping");
		return false;
	}
	// All posts are indexed as duplicate targets regardless of author,
	// including those the bot would never answer

	if (isDiscussion) {
		const categorySlug = context.payload.discussion.category?.slug;
		if (!QUESTION_CATEGORY_SLUGS.includes(categorySlug)) {
			console.log(`Skipping discussion in category ${categorySlug}`);
			return false;
		}
	} else if (context.payload.issue?.pull_request) {
		console.log("Skipping pull request");
		return false;
	}

	const indexPath = process.env.POSTS_INDEX_PATH;
	const index = await loadPostsIndex(indexPath);
	if (!index) {
		// The nightly rebuild will pick this post up
		console.log(`No posts index found at ${indexPath}, skipping`);
		return false;
	}

	const embeddedText = cleanQuestion(post.title, post.body ?? "");
	const hash = hashPost(embeddedText);

	const type = isDiscussion ? "discussion" : "issue";
	const existing = index.posts.find(
		(p) => p.type === type && p.number === post.number,
	);
	if (existing?.hash === hash) {
		console.log("Post is already indexed and unchanged, skipping");
		return false;
	}

	const [embedding] = await embedBatched(
		[embeddedText],
		modelsToken,
		index.model,
	);
	/** @type {import("./postsIndex.cjs").IndexedPost} */
	const entry = {
		type,
		number: post.number,
		title: post.title,
		url: post.html_url,
		state: "open",
		createdAt: post.created_at,
		closedAt: null,
		labels: isDiscussion
			? []
			: (post.labels ?? []).map((/** @type {any} */ l) => l.name),
		hash,
		embedding,
	};

	if (existing) {
		index.posts[index.posts.indexOf(existing)] = entry;
		console.log(`Updated ${type} #${post.number} in the posts index`);
	} else {
		index.posts.push(entry);
		console.log(`Added ${type} #${post.number} to the posts index`);
	}

	// indexPath is defined, loadPostsIndex would have returned undefined otherwise
	await fs.writeFile(
		/** @type {string} */ (indexPath),
		JSON.stringify(index),
	);
	return true;
}

module.exports = main;
