// @ts-check

// Renders the collected feedback on docs answer bot comments into a
// digest and maintains it as the body of a dedicated issue, giving
// maintainers insight into which answers work and where the docs
// need improvement. The body is rewritten in place on every run.
//
// Usage: node updateDocsFeedbackIssue.cjs <records-file>
// Requires GITHUB_TOKEN and GITHUB_REPOSITORY in the environment.

const fs = require("node:fs/promises");
const {
	SCAN_WINDOW_DAYS,
	SUPPRESS_SCORE,
} = require("./collectDocsFeedback.cjs");
const { ghPaginated, ghRequest } = require("./githubApi.cjs");

const ISSUE_TITLE = "📊 Docs answer bot feedback";
const ISSUE_MARKER = "<!-- DOCS_FEEDBACK_ISSUE -->";
// zwave-js-ui has no dedicated "docs-feedback" label, so the existing
// "documentation" label is reused to narrow the digest issue lookup to a
// handful of candidates (searching by creator alone could exceed a single
// page of results). The hidden marker above still uniquely identifies
// the digest issue among any other issues carrying this label.
const ISSUE_LABEL = "documentation";

// Keep suggested eval cases (and the issue body) readable
const MAX_EVAL_QUESTION_LENGTH = 300;

/**
 * Keeps user-controlled text from pinging people via @mentions
 * by inserting a zero-width space after each @
 * @param {string} text
 */
function neutralizeMentions(text) {
	return text.replace(/@/g, "@\u200b");
}

/**
 * Summarizes the votes as anonymous weighted counts
 * @param {import("./collectDocsFeedback.cjs").FeedbackRecord} record
 */
function renderVotes(record) {
	const up = record.votes.filter((v) => v.weight > 0);
	const down = record.votes.filter((v) => v.weight < 0);
	const parts = [];
	if (up.length > 0) {
		parts.push(
			`${up.length}× 👍 (+${up.reduce((sum, v) => sum + v.weight, 0)})`,
		);
	}
	if (down.length > 0) {
		parts.push(
			`${down.length}× 👎 (${
				down.reduce((sum, v) => sum + v.weight, 0)
			})`,
		);
	}
	return parts.join(", ");
}

/**
 * @param {import("./collectDocsFeedback.cjs").FeedbackRecord} record
 */
function renderRecord(record) {
	const lines = [
		`### [${neutralizeMentions(record.title)}](${record.postUrl}) — score ${
			record.score > 0 ? "+" : ""
		}${record.score}`,
		`[Bot answer](${record.commentUrl})${
			record.style === "links"
				? " (links only)"
				: record.style === "posts"
				? " (related posts only)"
				: ""
		}${
			record.confidence != null
				? `, confidence ${record.confidence}`
				: ""
		}`,
		`Votes: ${renderVotes(record)}`,
	];
	if (record.sections.length > 0) {
		lines.push(
			`Linked sections: ${
				record.sections.map((s) => `\`${s}\``).join(", ")
			}`,
		);
	}
	if (record.score <= SUPPRESS_SCORE && record.style !== "posts") {
		lines.push(
			"🚫 Suppressed: similar questions currently get a demoted response",
		);
	}
	return lines.join("\n");
}

/**
 * Renders a ready-to-paste eval case for docsAnswersEvalCases.json
 * @param {import("./collectDocsFeedback.cjs").FeedbackRecord} record
 */
function renderEvalCase(record) {
	const evalCase = {
		question: record.question.slice(0, MAX_EVAL_QUESTION_LENGTH),
		expectedFiles: [
			...new Set(record.sections.map((s) => s.split("#")[0])),
		],
	};
	return `<details><summary>Suggested eval case</summary>

\`\`\`json
${JSON.stringify(evalCase, undefined, "\t")}
\`\`\`

</details>`;
}

/**
 * @param {import("./collectDocsFeedback.cjs").FeedbackRecord[]} records
 */
function renderDigest(records) {
	const withFeedback = records.filter((r) => r.votes.length > 0);
	const good = withFeedback
		.filter((r) => r.score > 0)
		.sort((a, b) => b.score - a.score);
	const bad = withFeedback
		.filter((r) => r.score < 0)
		.sort((a, b) => a.score - b.score);

	const sections = [
		ISSUE_MARKER,
		`_Automatically generated from reactions to the bot's answers in issues and discussions over the last ${SCAN_WINDOW_DAYS} days. Maintainer votes count ×5, the question author's ×2. Last updated: ${
			new Date().toISOString().slice(0, 10)
		}_`,
		`## Summary

- ${records.length} answers posted, ${withFeedback.length} with feedback
- ${good.length} rated helpful, ${bad.length} rated unhelpful`,
	];

	if (bad.length > 0) {
		sections.push(
			`## Needs attention

Negative feedback usually means the linked documentation did not answer the question — these are candidates for docs improvements.

${bad.map(renderRecord).join("\n\n")}`,
		);
	}

	if (good.length > 0) {
		sections.push(
			`## Confirmed good

These answers were rated helpful. Consider curating them into \`docsAnswersEvalCases.json\` to lock in the retrieval quality.

${good.map((r) => `${renderRecord(r)}\n${renderEvalCase(r)}`).join("\n\n")}`,
		);
	}

	return sections.join("\n\n");
}

/**
 * Creates the digest issue or rewrites its body in place
 * @param {import("./collectDocsFeedback.cjs").FeedbackRecord[]} records
 * @param {string} owner
 * @param {string} repo
 * @param {string} token
 */
async function updateFeedbackIssue(records, owner, repo, token) {
	const body = renderDigest(records);

	// The marker identifies the digest issue regardless of its title
	const candidates = await ghPaginated(
		`/repos/${owner}/${repo}/issues?labels=${ISSUE_LABEL}&state=all&per_page=100`,
		token,
	);
	const existing = candidates.find((i) => i.body?.includes(ISSUE_MARKER));

	if (existing) {
		await ghRequest(
			"PATCH",
			`/repos/${owner}/${repo}/issues/${existing.number}`,
			{ body, state: "open" },
			token,
		);
		console.log(`Updated feedback digest in issue #${existing.number}`);
	} else {
		const created = await ghRequest(
			"POST",
			`/repos/${owner}/${repo}/issues`,
			{ title: ISSUE_TITLE, body, labels: [ISSUE_LABEL] },
			token,
		);
		console.log(`Created feedback digest issue #${created.number}`);
	}
}

async function main() {
	const [recordsFile] = process.argv.slice(2);
	if (!recordsFile) {
		console.error("Usage: node updateDocsFeedbackIssue.cjs <records-file>");
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

	const records = JSON.parse(await fs.readFile(recordsFile, "utf8"));
	await updateFeedbackIssue(records, owner, repo, token);
}

if (require.main === module) {
	main().catch((e) => {
		console.error(e);
		process.exit(1);
	});
}
