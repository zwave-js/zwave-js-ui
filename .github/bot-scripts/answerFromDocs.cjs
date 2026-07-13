// @ts-check

/// <reference path="types.d.ts" />

const fs = require("node:fs/promises");
const { cosineSimilarity, retrieve } = require("./docsIndex.cjs");
const { CHAT_MODEL, embed, modelsRequest } = require("./modelsApi.cjs");
const {
	QUESTION_CATEGORY_SLUGS,
	cleanQuestion,
	loadPostsIndex,
	rankRelatedPosts,
} = require("./postsIndex.cjs");

const DOCS_BASE_URL = "https://zwave-js.github.io/zwave-js-ui/#";
const DOCS_ANSWER_COMMENT_TAG = "<!-- DOCS_ANSWER_COMMENT_TAG -->";
const DOCS_ANSWER_METADATA_TAG = "DOCS_ANSWER_METADATA";
const DOCS_ANSWER_METADATA_VERSION = 1;

// Users whose posts should never be answered automatically
const EXCLUDED_USERS = ["AlCalzone", "zwave-js-bot"];

const MAX_RETRIEVED_CHUNKS = 5;
// If not even the best dense match reaches this cosine similarity,
// the post is considered off-topic and no chat request is made.
// The real relevance judgment is left to the chat model.
const MIN_SIMILARITY = 0.2;
// Confidence thresholds for the different response styles
const ANSWER_CONFIDENCE = 75;
const LINKS_CONFIDENCE = 40;

// A related post is only suggested above this cosine similarity.
// A wrong suggestion is worse than a missed one, so keep this high.
const POSTS_MIN_SIMILARITY = 0.55;
const MAX_RELATED_POSTS = 3;

// Questions at least this similar to a previously downvoted answer
// get a demoted response: full answer -> links only, links only -> silence
const SUPPRESS_SIMILARITY = 0.9;

/** @param {{file: string, anchor: string}} chunk */
function chunkUrl(chunk) {
	const docPath = chunk.file.replace(/(README|index)?\.md$/, "");
	let url = `${DOCS_BASE_URL}/${docPath}`;
	if (chunk.anchor) url += `?id=${chunk.anchor}`;
	return url;
}

/**
 * Checks whether the bot already answered this post
 * @param {{github: Github, context: Context}} param0
 * @param {any} post
 * @param {boolean} isDiscussion
 */
async function alreadyAnswered({ github, context }, post, isDiscussion) {
	if (isDiscussion) {
		const existing = await github.graphql(
			`
			query getComments($discussionId: ID!) {
				node(id: $discussionId) {
					... on Discussion {
						comments(first: 50) {
							nodes { body }
						}
					}
				}
			}
			`,
			{ discussionId: post.node_id },
		);
		return !!existing.node?.comments?.nodes?.some(
			(/** @type {any} */ c) => c.body.includes(DOCS_ANSWER_COMMENT_TAG),
		);
	} else {
		const { data: comments } = await github.rest.issues.listComments({
			...context.repo,
			issue_number: post.number,
			per_page: 100,
		});
		return comments.some((c) => c.body?.includes(DOCS_ANSWER_COMMENT_TAG));
	}
}

/**
 * Asks the chat model whether the given doc excerpts answer the question
 * @param {string} question
 * @param {{chunk: any}[]} ranked Retrieved chunks, most relevant first
 * @param {string} token
 * @returns {Promise<{confidence: number, answer: string | null, relatedExcerpts: number[]}>}
 */
async function judgeAnswer(question, ranked, token) {
	const excerpts = ranked
		.map((r, i) => `
<excerpt id="${i}" section="${r.chunk.breadcrumbs.join(" > ")}">
${r.chunk.text}
</excerpt>`)
		.join("\n");

	const systemPrompt = `
You are a support assistant for the Z-Wave JS UI project, a Z-Wave control panel and MQTT gateway built on top of Z-Wave JS.
A user has posted a question. You are given excerpts from the project documentation that might answer it.

Determine whether the excerpts actually answer the user's question, and respond with a JSON object with the following fields:
- "confidence": a number between 0 and 100 indicating how confident you are that the excerpts fully answer the question. Use 0 if the post is not a question, or the excerpts are unrelated to it.
- "answer": if the excerpts answer the question, a concise answer (a few sentences, markdown) based ONLY on the excerpts. Otherwise null.
- "relatedExcerpts": an array with the ids (numbers) of the excerpts that are relevant to the question, most relevant first. Leave empty if none are.

Rules:
1. Base your answer solely on the given excerpts. Do not use outside knowledge.
2. Do not mention the excerpts in the answer text.
3. Do not refer to the user's question with phrases like "here's the answer to your question". Just answer directly.
4. Respond with the JSON object only.`.trim();

	const userPrompt = `## User's post

${question}

## Documentation excerpts
${excerpts}`;

	const chatResponse = await modelsRequest("/chat/completions", {
		model: CHAT_MODEL,
		messages: [
			{ role: "system", content: systemPrompt },
			{ role: "user", content: userPrompt },
		],
		response_format: { type: "json_object" },
		max_tokens: 1000,
		temperature: 0.2,
	}, token);

	return JSON.parse(chatResponse.choices[0].message.content);
}

/**
 * Determines how the answer to a question must be demoted based on
 * its similarity to previously downvoted answers: a downvoted full
 * answer allows links only, downvoted links mean staying silent
 * @param {number[]} questionEmbedding
 * @param {{model: string, suppressed: {embedding: number[], style: string, url: string}[]} | undefined} feedback
 * @param {string} embeddingModel
 * @returns {"allow" | "linksOnly" | "silent"}
 */
function checkSuppression(questionEmbedding, feedback, embeddingModel) {
	// Embeddings from different models are not comparable
	if (!feedback || feedback.model !== embeddingModel) return "allow";

	/** @type {"allow" | "linksOnly" | "silent"} */
	let result = "allow";
	for (const entry of feedback.suppressed ?? []) {
		// The cache could be stale or corrupted. Skip malformed entries,
		// a mismatched vector length would yield NaN below
		if (
			!Array.isArray(entry.embedding)
			|| entry.embedding.length !== questionEmbedding.length
		) {
			continue;
		}
		const similarity = cosineSimilarity(
			questionEmbedding,
			entry.embedding,
		);
		if (!(similarity >= SUPPRESS_SIMILARITY)) continue;
		console.log(
			`Question is similar (${
				similarity.toFixed(3)
			}) to a downvoted answer: ${entry.url}`,
		);
		if (entry.style === "links") return "silent";
		result = "linksOnly";
	}
	return result;
}

/**
 * Retrieves documentation for the question, judges whether it answers it,
 * and renders the docs part of the comment
 * @param {string} question
 * @param {number[]} questionEmbedding
 * @param {any} index The docs embeddings index
 * @param {string} token
 * @param {boolean} allowAnswer Render doc links only when false
 * @returns {Promise<{text: string, style: "answer" | "links", confidence: number, sections: string[]} | undefined>}
 */
async function buildDocsAnswerSection(
	question,
	questionEmbedding,
	index,
	token,
	allowAnswer,
) {
	const { results: ranked, bestSimilarity } = retrieve(
		index,
		questionEmbedding,
		question,
		MAX_RETRIEVED_CHUNKS,
	);

	if (bestSimilarity < MIN_SIMILARITY) {
		console.log(
			`Best similarity ${
				bestSimilarity.toFixed(3)
			} below floor, post is likely off-topic`,
		);
		return;
	}

	console.log(
		"Top matches:",
		ranked.map((r) =>
			`cos=${r.similarity.toFixed(3)} bm25=${
				r.lexical.toFixed(1)
			} ${r.chunk.file}#${r.chunk.anchor}`
		),
	);
	if (ranked.length === 0) {
		console.log("No relevant documentation found");
		return;
	}

	// Ask the model whether the docs answer the question
	/** @type {{confidence: number, answer: string | null, relatedExcerpts: number[]}} */
	let result;
	try {
		result = await judgeAnswer(question, ranked, token);
	} catch (e) {
		console.log("Failed to parse model response:", e);
		return;
	}
	console.log("Model response:", JSON.stringify(result));

	const related = (result.relatedExcerpts ?? [])
		.map((i) => ranked[i]?.chunk)
		.filter(Boolean);

	if (result.confidence < LINKS_CONFIDENCE || related.length === 0) {
		console.log("Confidence too low, not answering");
		return;
	}

	// When linking to a section, don't also link to its subsections
	const isAncestor = (
		/** @type {any} */ a,
		/** @type {any} */ b,
	) => a.file === b.file
		&& a.breadcrumbs.length < b.breadcrumbs.length
		&& a.breadcrumbs.every(
			(/** @type {string} */ crumb, /** @type {number} */ i) =>
				crumb === b.breadcrumbs[i],
		);
	// Sub-splits of the same section share a URL, only link it once
	/** @type {Set<string>} */
	const seenUrls = new Set();
	const deduped = related.filter((chunk) => {
		if (related.some((other) => isAncestor(other, chunk))) return false;
		const url = chunkUrl(chunk);
		if (seenUrls.has(url)) return false;
		seenUrls.add(url);
		return true;
	});

	const links = deduped
		.map((chunk) => {
			const label = chunk.breadcrumbs.join(" → ");
			return `- [${label}](${chunkUrl(chunk)})`;
		})
		.join("\n");

	const sections = deduped.map((chunk) => `${chunk.file}#${chunk.anchor}`);
	const single = deduped.length === 1;
	if (
		allowAnswer && result.confidence >= ANSWER_CONFIDENCE && result.answer
	) {
		return {
			text: `${result.answer}

${
				single
					? "This section of the documentation has more details:"
					: "These sections of the documentation have more details:"
			}
${links}`,
			style: "answer",
			confidence: result.confidence,
			sections,
		};
	} else {
		return {
			text: `${
				single
					? "This section of the documentation might answer your question:"
					: "These sections of the documentation might answer your question:"
			}

${links}`,
			style: "links",
			confidence: result.confidence,
			sections,
		};
	}
}

/** @param {import("./postsIndex.cjs").IndexedPost} post */
function describePostState(post) {
	if (post.type === "issue") {
		return post.state === "open" ? "open issue" : "closed issue";
	}
	if (post.state === "answered") return "answered discussion";
	if (post.state === "closed") return "closed discussion";
	return "discussion";
}

/**
 * Ranks existing posts by similarity and renders the related-posts part
 * of the comment
 * @param {NonNullable<Awaited<ReturnType<typeof loadPostsIndex>>>} index
 * @param {number[]} questionEmbedding
 * @param {{type: "issue" | "discussion", number: number}} self
 * @returns {string | undefined}
 */
function buildRelatedPostsSection(index, questionEmbedding, self) {
	// Log more candidates than are shown, as tuning signal for the floor
	const candidates = rankRelatedPosts(index, questionEmbedding, self, {
		minSimilarity: 0,
		maxResults: 10,
	});
	console.log(
		"Top related posts:",
		candidates.map((c) =>
			`cos=${c.similarity.toFixed(3)} ${c.post.type} #${c.post.number}`
		),
	);

	const shown = candidates
		.filter((c) => c.similarity >= POSTS_MIN_SIMILARITY)
		.slice(0, MAX_RELATED_POSTS);
	if (shown.length === 0) {
		console.log("No sufficiently similar posts found");
		return;
	}

	const links = shown
		.map(({ post }) => {
			// Backslashes and square brackets in titles would break the markdown link
			const title = post.title.replace(/[\\[\]]/g, "\\$&");
			return `- [${title}](${post.url}) (${describePostState(post)})`;
		})
		.join("\n");

	return `${
		shown.length === 1
			? "This existing post looks similar to yours and might be related — a maintainer will confirm:"
			: "These existing posts look similar to yours and might be related — a maintainer will confirm:"
	}

${links}`;
}

/**
 * Answers a user's question in an issue or discussion based on the
 * documentation, and/or suggests similar existing posts, in a single comment.
 *
 * Expects the following environment variables:
 * - MODELS_TOKEN: token with models:read permission
 * - DOCS_INDEX_PATH: path to the embeddings index created by buildDocsIndex.cjs
 * - POSTS_INDEX_PATH: path to the embeddings index created by buildPostsIndex.cjs
 *
 * @param {{github: Github, context: Context}} param
 */
async function main(param) {
	const { github, context } = param;

	const modelsToken = process.env.MODELS_TOKEN;
	if (!modelsToken) {
		console.log("No MODELS_TOKEN provided, skipping");
		return;
	}
	// Figure out where the question comes from
	const isDiscussion = !!context.payload.discussion;
	const post = context.payload.discussion ?? context.payload.issue;
	if (!post) {
		console.log("No issue or discussion in payload, skipping");
		return;
	}

	const author = post.user?.login;
	if (
		!author
		|| EXCLUDED_USERS.includes(author)
		|| post.user?.type === "Bot"
	) {
		console.log(`Skipping post by ${author}`);
		return;
	}

	if (isDiscussion) {
		const categorySlug = context.payload.discussion.category?.slug;
		if (!QUESTION_CATEGORY_SLUGS.includes(categorySlug)) {
			console.log(
				`Skipping discussion in category ${categorySlug}`,
			);
			return;
		}
	}

	// Check for an existing answer before spending any Models API requests.
	// This also makes re-runs on edited posts cheap no-ops.
	if (await alreadyAnswered({ github, context }, post, isDiscussion)) {
		console.log("Already answered, skipping");
		return;
	}

	// Load the pre-built embeddings indices. Either may be missing,
	// each one enables its part of the comment.
	const docsIndexPath = process.env.DOCS_INDEX_PATH;
	/** @type {any} */
	let docsIndex;
	try {
		docsIndex = JSON.parse(await fs.readFile(docsIndexPath, "utf8"));
		console.log(
			`Loaded docs index with ${docsIndex.chunks.length} chunks (created ${docsIndex.createdAt})`,
		);
	} catch {
		console.log(`No docs index found at ${docsIndexPath}`);
	}

	let postsIndex = await loadPostsIndex(process.env.POSTS_INDEX_PATH);
	if (postsIndex) {
		console.log(
			`Loaded posts index with ${postsIndex.posts.length} posts (created ${postsIndex.createdAt})`,
		);
	} else {
		console.log(
			`No posts index found at ${process.env.POSTS_INDEX_PATH}`,
		);
	}

	if (!docsIndex && !postsIndex) return;

	const question = cleanQuestion(post.title, post.body ?? "");

	// A single embedding request serves both docs retrieval and
	// related-post ranking. Similarities are only comparable within
	// one model, so an index embedded with a different model is skipped.
	const embeddingModel = docsIndex?.model ?? postsIndex?.model;
	if (postsIndex && postsIndex.model !== embeddingModel) {
		console.log(
			`Posts index model ${postsIndex.model} does not match ${embeddingModel}, ignoring it`,
		);
		postsIndex = undefined;
		if (!docsIndex) return;
	}
	const [questionEmbedding] = await embed(
		[question],
		modelsToken,
		embeddingModel,
	);

	// Feedback guardrail: check the question against previously
	// downvoted answers collected by collectDocsFeedback.cjs
	let suppression = "allow";
	const feedbackPath = process.env.DOCS_FEEDBACK_PATH;
	if (feedbackPath) {
		/** @type {any} */
		let feedback;
		try {
			feedback = JSON.parse(await fs.readFile(feedbackPath, "utf8"));
		} catch {
			console.log(`No feedback data found at ${feedbackPath}`);
		}
		suppression = checkSuppression(
			questionEmbedding,
			feedback,
			embeddingModel,
		);
	}

	const docsSection = docsIndex && suppression !== "silent"
		? await buildDocsAnswerSection(
			question,
			questionEmbedding,
			docsIndex,
			modelsToken,
			suppression === "allow",
		)
		: undefined;

	const postsSection = postsIndex
		? buildRelatedPostsSection(postsIndex, questionEmbedding, {
			type: isDiscussion ? "discussion" : "issue",
			number: post.number,
		})
		: undefined;

	if (!docsSection && !postsSection) {
		console.log("Nothing to answer or suggest, skipping");
		return;
	}

	// Compose the comment
	let body = `**Beep, boop! 🤖**

`;
	if (docsSection) {
		body +=
			`_I've tried to answer your question based on the documentation. If this doesn't help, please wait for a human to show up._

${docsSection.text}`;
		if (postsSection) {
			body += `

---

${postsSection}`;
		}
	} else {
		body +=
			`_I've found existing posts that look similar to yours. If they don't help, please wait for a human to show up._

${postsSection}`;
	}

	// Metadata for collectDocsFeedback.cjs to attribute
	// reactions to doc sections without re-parsing the comment
	const metadata = {
		v: DOCS_ANSWER_METADATA_VERSION,
		style: docsSection?.style ?? "posts",
		confidence: docsSection?.confidence ?? null,
		sections: docsSection?.sections ?? [],
	};

	body += `

---

_${
		docsSection
			? "This answer was"
			: "These suggestions were"
	} generated automatically${
		docsSection ? " based on the documentation" : ""
	}. AI can make mistakes, always check important info._
_Was this helpful? React with 👍 or 👎 to let us know._
${DOCS_ANSWER_COMMENT_TAG}
<!-- ${DOCS_ANSWER_METADATA_TAG} ${JSON.stringify(metadata)} -->`;

	if (isDiscussion) {
		await github.graphql(
			`
			mutation addDiscussionComment($discussionId: ID!, $body: String!) {
				addDiscussionComment(input: {discussionId: $discussionId, body: $body}) {
					comment { id }
				}
			}
			`,
			{ discussionId: post.node_id, body },
		);
	} else {
		await github.rest.issues.createComment({
			...context.repo,
			issue_number: post.number,
			body,
		});
	}
	console.log("Posted docs answer comment");
}

module.exports = main;
module.exports.judgeAnswer = judgeAnswer;
module.exports.DOCS_ANSWER_COMMENT_TAG = DOCS_ANSWER_COMMENT_TAG;
module.exports.DOCS_ANSWER_METADATA_TAG = DOCS_ANSWER_METADATA_TAG;
module.exports.DOCS_ANSWER_METADATA_VERSION = DOCS_ANSWER_METADATA_VERSION;
module.exports.DOCS_BASE_URL = DOCS_BASE_URL;
