// @ts-check

// Collects reactions to the docs answer bot's comments in issues and
// discussions and computes a weighted feedback score per answer.
// Reactions are the source of truth, so each run rescans the last
// FEEDBACK_WINDOW_DAYS and recomputes everything from scratch.
//
// Usage: node collectDocsFeedback.cjs <feedback-out> <records-out>
// Requires GITHUB_TOKEN and GITHUB_REPOSITORY in the environment.
//
// <feedback-out> receives the suppression list (downvoted questions with
// embeddings) consumed by answerFromDocs.cjs, <records-out> the full
// feedback records consumed by updateDocsFeedbackIssue.cjs.

const fs = require("node:fs/promises");
const path = require("node:path");
const {
	DOCS_ANSWER_COMMENT_TAG,
	DOCS_ANSWER_METADATA_TAG,
	DOCS_ANSWER_METADATA_VERSION,
	DOCS_BASE_URL,
} = require("./answerFromDocs.cjs");
const { ghGraphql, ghPaginated, ghRequest } = require("./githubApi.cjs");
const { embed, EMBEDDING_MODEL } = require("./modelsApi.cjs");
const { cleanQuestion } = require("./postsIndex.cjs");
const { authorizedUsers } = require("./authorizedUsers.cjs");

const BOT_USER = "zwave-js-bot";
const SCAN_WINDOW_DAYS = Number(process.env.FEEDBACK_WINDOW_DAYS || "180");

// Maintainers know best whether an answer is correct,
// the post's author knows best whether it helped
const MAINTAINER_WEIGHT = 5;
const AUTHOR_WEIGHT = 2;
const DEFAULT_WEIGHT = 1;

// A single drive-by downvote does not suppress future answers,
// a maintainer downvote or the author plus one other person does
const SUPPRESS_SCORE = -3;

// Reaction contents in REST ("+1") and GraphQL ("THUMBS_UP") notation
/** @type {Record<string, number>} */
const REACTION_SIGNS = {
	"+1": 1,
	heart: 1,
	hooray: 1,
	rocket: 1,
	"-1": -1,
	confused: -1,
	THUMBS_UP: 1,
	HEART: 1,
	HOORAY: 1,
	ROCKET: 1,
	THUMBS_DOWN: -1,
	CONFUSED: -1,
};

/**
 * Extracts the metadata the bot embeds in its answer comments.
 * Comments from before the metadata tag existed fall back to
 * parsing the doc links from the comment body.
 * @param {string} body
 * @returns {{style: string, confidence: number | null, sections: string[]}}
 */
function parseAnswerMetadata(body) {
	const match = body.match(
		new RegExp(`<!-- ${DOCS_ANSWER_METADATA_TAG} (\\{.*?\\}) -->`),
	);
	if (match) {
		try {
			const metadata = JSON.parse(match[1]);
			// Fields of unknown metadata versions may not mean the same
			if (metadata.v === DOCS_ANSWER_METADATA_VERSION) {
				return {
					style: metadata.style ?? "answer",
					confidence: metadata.confidence ?? null,
					sections: metadata.sections ?? [],
				};
			}
		} catch {
			// Fall through to link parsing
		}
	}

	/** @type {string[]} */
	const sections = [];
	// Match any markdown link target and filter by string prefix
	// so the URL never needs to be escaped into a regex
	for (const [, target] of body.matchAll(/\]\(([^)\s]+)\)/g)) {
		if (!target.startsWith(`${DOCS_BASE_URL}/`)) continue;
		const [docPath, query] = target
			.slice(DOCS_BASE_URL.length + 1)
			.split("?");
		const anchor = query?.match(/(?:^|&)id=([^&]*)/)?.[1] ?? "";
		// chunkUrl() strips (README|index).md, assume README.md for bare paths
		const file = docPath.endsWith("/") || docPath === ""
			? `${docPath}README.md`
			: `${docPath}.md`;
		sections.push(`${file}#${anchor}`);
	}
	// Docs answers always link sections, so none means related posts only
	return {
		style: sections.length > 0 ? "answer" : "posts",
		confidence: null,
		sections,
	};
}

/**
 * @param {string} login
 * @param {string} postAuthor
 */
function reactionWeight(login, postAuthor) {
	if (
		authorizedUsers.some((u) => u.toLowerCase() === login.toLowerCase())
	) {
		return MAINTAINER_WEIGHT;
	}
	if (login.toLowerCase() === postAuthor.toLowerCase()) {
		return AUTHOR_WEIGHT;
	}
	return DEFAULT_WEIGHT;
}

/**
 * Turns raw reactions into weighted votes and a net score
 * @param {{user: string, content: string}[]} reactions
 * @param {string} postAuthor
 */
function scoreReactions(reactions, postAuthor) {
	const votes = [];
	let score = 0;
	for (const { user, content } of reactions) {
		const sign = REACTION_SIGNS[content];
		if (!sign || !user || user.endsWith("[bot]")) continue;
		const weight = reactionWeight(user, postAuthor);
		votes.push({ user, content, weight: sign * weight });
		score += sign * weight;
	}
	return { votes, score };
}

/**
 * @typedef {object} FeedbackRecord
 * @property {"issue" | "discussion"} type
 * @property {string} postUrl
 * @property {string} commentUrl
 * @property {string} title
 * @property {string} author
 * @property {string} question
 * @property {string} style
 * @property {number | null} confidence
 * @property {string[]} sections
 * @property {{user: string, content: string, weight: number}[]} votes
 * @property {number} score
 */

/**
 * @param {string} owner
 * @param {string} repo
 * @param {string} since yyyy-mm-dd
 * @param {string} token
 * @returns {Promise<FeedbackRecord[]>}
 */
async function collectFromIssues(owner, repo, since, token) {
	/** @type {FeedbackRecord[]} */
	const records = [];

	const query = encodeURIComponent(
		`repo:${owner}/${repo} is:issue commenter:${BOT_USER} updated:>=${since}`,
	);
	/** @type {any[]} */
	const issues = [];
	for (let page = 1;; page++) {
		const result = await ghRequest(
			"GET",
			`/search/issues?q=${query}&per_page=100&page=${page}`,
			undefined,
			token,
		);
		issues.push(...result.items);
		if (issues.length >= result.total_count || result.items.length === 0) {
			break;
		}
	}

	for (const issue of issues) {
		const comments = await ghPaginated(
			`/repos/${owner}/${repo}/issues/${issue.number}/comments?per_page=100`,
			token,
		);
		const answers = comments.filter((c) =>
			c.user?.login === BOT_USER
			&& c.body?.includes(DOCS_ANSWER_COMMENT_TAG)
		);
		for (const answer of answers) {
			/** @type {{user: string, content: string}[]} */
			let reactions = [];
			if (answer.reactions?.total_count > 0) {
				/** @type {any[]} */
				const raw = await ghRequest(
					"GET",
					`/repos/${owner}/${repo}/issues/comments/${answer.id}/reactions?per_page=100`,
					undefined,
					token,
				);
				reactions = raw.map((r) => ({
					user: r.user?.login ?? "",
					content: r.content,
				}));
			}
			const author = issue.user?.login ?? "";
			const { votes, score } = scoreReactions(reactions, author);
			records.push({
				type: "issue",
				postUrl: issue.html_url,
				commentUrl: answer.html_url,
				title: issue.title,
				author,
				question: cleanQuestion(issue.title, issue.body ?? ""),
				...parseAnswerMetadata(answer.body),
				votes,
				score,
			});
		}
	}

	return records;
}

/**
 * @param {string} owner
 * @param {string} repo
 * @param {string} since yyyy-mm-dd
 * @param {string} token
 * @returns {Promise<FeedbackRecord[]>}
 */
async function collectFromDiscussions(owner, repo, since, token) {
	/** @type {FeedbackRecord[]} */
	const records = [];

	// Shared between the search query and the more-comments query
	const commentFields = `
		nodes {
			body
			url
			author { login }
			reactions(first: 100) {
				nodes {
					content
					user { login }
				}
			}
		}`;

	const searchQuery =
		`repo:${owner}/${repo} commenter:${BOT_USER} updated:>=${since}`;
	let cursor = null;
	for (;;) {
		const data = await ghGraphql(
			`
			query search($searchQuery: String!, $cursor: String) {
				search(type: DISCUSSION, query: $searchQuery, first: 25, after: $cursor) {
					pageInfo { hasNextPage endCursor }
					nodes {
						... on Discussion {
							id
							title
							body
							url
							author { login }
							comments(first: 100) {
								pageInfo { hasNextPage endCursor }
								${commentFields}
							}
						}
					}
				}
			}
			`,
			{ searchQuery, cursor },
			token,
		);

		for (const discussion of data.search.nodes) {
			const comments = [...(discussion.comments?.nodes ?? [])];
			// Fetch remaining comment pages of busy discussions
			let commentsPage = discussion.comments?.pageInfo;
			while (commentsPage?.hasNextPage) {
				const more = await ghGraphql(
					`
					query moreComments($id: ID!, $cursor: String) {
						node(id: $id) {
							... on Discussion {
								comments(first: 100, after: $cursor) {
									pageInfo { hasNextPage endCursor }
									${commentFields}
								}
							}
						}
					}
					`,
					{ id: discussion.id, cursor: commentsPage.endCursor },
					token,
				);
				comments.push(...(more.node?.comments?.nodes ?? []));
				commentsPage = more.node?.comments?.pageInfo;
			}

			const answers = comments.filter(
				(/** @type {any} */ c) =>
					c.author?.login === BOT_USER
					&& c.body?.includes(DOCS_ANSWER_COMMENT_TAG),
			);
			for (const answer of answers) {
				const reactions = (answer.reactions?.nodes ?? []).map(
					(/** @type {any} */ r) => ({
						user: r.user?.login ?? "",
						content: r.content,
					}),
				);
				const author = discussion.author?.login ?? "";
				const { votes, score } = scoreReactions(reactions, author);
				records.push({
					type: "discussion",
					postUrl: discussion.url,
					commentUrl: answer.url,
					title: discussion.title,
					author,
					question: cleanQuestion(
						discussion.title,
						discussion.body ?? "",
					),
					...parseAnswerMetadata(answer.body),
					votes,
					score,
				});
			}
		}

		if (!data.search.pageInfo.hasNextPage) break;
		cursor = data.search.pageInfo.endCursor;
	}

	return records;
}

/**
 * Collects all feedback on bot answers within the scan window
 * @param {string} owner
 * @param {string} repo
 * @param {string} token
 * @returns {Promise<FeedbackRecord[]>}
 */
async function collectFeedback(owner, repo, token) {
	const since = new Date(Date.now() - SCAN_WINDOW_DAYS * 86_400_000)
		.toISOString()
		.slice(0, 10);
	console.log(`Collecting feedback on bot answers since ${since}...`);

	const records = [
		...await collectFromIssues(owner, repo, since, token),
		...await collectFromDiscussions(owner, repo, since, token),
	];
	console.log(
		`Found ${records.length} bot answers, ${
			records.filter((r) => r.votes.length > 0).length
		} with feedback`,
	);
	return records;
}

async function main() {
	const [feedbackOut, recordsOut] = process.argv.slice(2);
	if (!feedbackOut || !recordsOut) {
		console.error(
			"Usage: node collectDocsFeedback.cjs <feedback-out> <records-out>",
		);
		process.exit(1);
	}
	const token = process.env.GITHUB_TOKEN;
	const repository = process.env.GITHUB_REPOSITORY;
	if (!token || !repository) {
		console.error(
			"GITHUB_TOKEN and GITHUB_REPOSITORY environment variables are required",
		);
		process.exit(1);
	}
	const [owner, repo] = repository.split("/");

	const records = await collectFeedback(owner, repo, token);

	await fs.mkdir(path.dirname(recordsOut), { recursive: true });
	await fs.writeFile(recordsOut, JSON.stringify(records, undefined, "\t"));

	// The suppression list makes answerFromDocs.cjs demote responses
	// to questions similar to these. The indices are built with the same
	// EMBEDDING_MODEL, so the runtime similarity comparison is valid.
	// Related-posts-only comments say nothing about the docs answer
	// quality, so they don't suppress anything.
	const downvoted = records.filter(
		(r) => r.score <= SUPPRESS_SCORE && r.style !== "posts",
	);
	const embeddings = downvoted.length > 0
		? await embed(downvoted.map((r) => r.question), token)
		: [];
	const suppressed = downvoted
		.map((r, i) => ({
			question: r.question,
			embedding: embeddings[i],
			style: r.style,
			score: r.score,
			url: r.commentUrl,
		}))
		// Guard against the embeddings response missing entries
		.filter((e) => Array.isArray(e.embedding));
	if (suppressed.length < downvoted.length) {
		console.log(
			`Dropped ${
				downvoted.length - suppressed.length
			} entries without embedding`,
		);
	}
	const feedback = {
		createdAt: new Date().toISOString(),
		model: EMBEDDING_MODEL,
		suppressed,
	};
	await fs.mkdir(path.dirname(feedbackOut), { recursive: true });
	await fs.writeFile(feedbackOut, JSON.stringify(feedback));
	console.log(
		`Wrote ${suppressed.length} suppression entries to ${feedbackOut}`,
	);
}

if (require.main === module) {
	main().catch((e) => {
		console.error(e);
		process.exit(1);
	});
}

module.exports = {
	SUPPRESS_SCORE,
	SCAN_WINDOW_DAYS,
};
