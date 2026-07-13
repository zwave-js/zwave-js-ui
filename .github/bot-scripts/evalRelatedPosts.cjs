// @ts-check

// Evaluates the retrieval quality of the related-posts suggestions
// against a golden set of questions with known related issues/discussions.
// Run daily in CI to catch regressions from changes to the cleaning/
// ranking logic or embedding model.
//
// Usage: node evalRelatedPosts.cjs <index-file>
// Requires GITHUB_TOKEN in the environment.

const fs = require("node:fs/promises");
const path = require("node:path");
const { logCase, reportResults } = require("./evalUtils.cjs");
const { embed } = require("./modelsApi.cjs");
const { rankRelatedPosts } = require("./postsIndex.cjs");

const NUM_RESULTS = 5;
// Allow a small number of misses before failing, retrieval is not exact
const MIN_HIT_RATE = Number(process.env.MIN_HIT_RATE || "0.8");

async function main() {
	const [indexFile] = process.argv.slice(2);
	if (!indexFile) {
		console.error("Usage: node evalRelatedPosts.cjs <index-file>");
		process.exit(1);
	}
	const token = process.env.GITHUB_TOKEN;
	if (!token) {
		console.error("GITHUB_TOKEN environment variable is required");
		process.exit(1);
	}

	const index = JSON.parse(await fs.readFile(indexFile, "utf8"));
	/** @type {{question: string, expectedPosts: {type: string, number: number}[]}[]} */
	const allCases = JSON.parse(
		await fs.readFile(
			path.join(__dirname, "relatedPostsEvalCases.json"),
			"utf8",
		),
	);

	// Expected posts can leave the index (closed issues age out after a
	// year), which is not a retrieval regression. Skip those cases.
	const inIndex = (/** @type {{type: string, number: number}} */ p) =>
		index.posts.some(
			(/** @type {any} */ ip) =>
				ip.type === p.type && ip.number === p.number,
		);
	const cases = allCases.filter((c) => {
		if (c.expectedPosts.some(inIndex)) return true;
		console.log(
			`⏭️ ${
				c.question.split("\n")[0]
			} - no expected post in the index anymore, skipping`,
		);
		return false;
	});

	// A single batched request embeds all eval questions at once
	const embeddings = await embed(
		cases.map((c) => c.question),
		token,
		index.model,
	);

	/** @type {import("./evalUtils.cjs").EvalResult[]} */
	const failures = [];
	for (let i = 0; i < cases.length; i++) {
		const { question, expectedPosts } = cases[i];
		const results = rankRelatedPosts(
			index,
			embeddings[i],
			// Eval questions are not posts themselves, exclude nothing
			{ type: "", number: 0 },
			{ minSimilarity: 0, maxResults: NUM_RESULTS },
		);
		const hit = expectedPosts.some((e) =>
			results.some(
				({ post }) => post.type === e.type && post.number === e.number,
			)
		);
		const result = {
			title: question.split("\n")[0],
			expected: expectedPosts.map((e) => `${e.type} #${e.number}`),
			retrieved: results.map(
				({ post, similarity }) =>
					`${post.type} #${post.number} (cos=${
						similarity.toFixed(3)
					})`,
			),
		};
		logCase(hit, result);
		if (!hit) failures.push(result);
	}

	await reportResults(NUM_RESULTS, cases.length, failures, MIN_HIT_RATE);
}

if (require.main === module) {
	main().catch((e) => {
		console.error(e);
		process.exit(1);
	});
}
