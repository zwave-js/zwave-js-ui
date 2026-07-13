// @ts-check

// Evaluates the retrieval quality of the docs answer bot against a
// golden set of questions with known relevant documentation files.
// Run daily in CI to catch regressions from docs restructuring or
// changes to the chunking/retrieval logic.
//
// Usage: node evalDocsAnswers.cjs <index-file> [--answers]
// Requires GITHUB_TOKEN in the environment.
//
// With --answers, each question is also run through the chat model and
// the generated answer is printed for manual inspection. This costs one
// chat request per question, so use sparingly.

const fs = require("node:fs/promises");
const path = require("node:path");
const { judgeAnswer } = require("./answerFromDocs.cjs");
const { retrieve } = require("./docsIndex.cjs");
const { logCase, reportResults } = require("./evalUtils.cjs");
const { embed } = require("./modelsApi.cjs");

const NUM_RESULTS = 5;
// Allow a small number of misses before failing, retrieval is not exact
const MIN_HIT_RATE = Number(process.env.MIN_HIT_RATE || "0.9");

async function main() {
	const args = process.argv.slice(2);
	const showAnswers = args.includes("--answers");
	const indexFile = args.find((a) => !a.startsWith("--"));
	if (!indexFile) {
		console.error(
			"Usage: node evalDocsAnswers.cjs <index-file> [--answers]",
		);
		process.exit(1);
	}
	const token = process.env.GITHUB_TOKEN;
	if (!token) {
		console.error("GITHUB_TOKEN environment variable is required");
		process.exit(1);
	}

	const index = JSON.parse(await fs.readFile(indexFile, "utf8"));
	/** @type {{question: string, expectedFiles: string[]}[]} */
	const cases = JSON.parse(
		await fs.readFile(
			path.join(__dirname, "docsAnswersEvalCases.json"),
			"utf8",
		),
	);

	// A single batched request embeds all eval questions at once
	const embeddings = await embed(
		cases.map((c) => c.question),
		token,
		index.model,
	);

	/** @type {import("./evalUtils.cjs").EvalResult[]} */
	const failures = [];
	for (let i = 0; i < cases.length; i++) {
		const { question, expectedFiles } = cases[i];
		const { results } = retrieve(
			index,
			embeddings[i],
			question,
			NUM_RESULTS,
		);
		const retrievedFiles = results.map((r) => r.chunk.file);
		const hit = expectedFiles.some((f) => retrievedFiles.includes(f));
		const result = {
			title: question.split("\n")[0],
			expected: expectedFiles,
			retrieved: retrievedFiles,
		};
		logCase(hit, result);
		if (!hit) failures.push(result);

		if (showAnswers) {
			const result = await judgeAnswer(question, results, token);
			console.log(`   confidence: ${result.confidence}`);
			console.log(
				`   ${
					(result.answer ?? "(no answer)").replaceAll("\n", "\n   ")
				}\n`,
			);
		}
	}

	await reportResults(NUM_RESULTS, cases.length, failures, MIN_HIT_RATE);
}

if (require.main === module) {
	main().catch((e) => {
		console.error(e);
		process.exit(1);
	});
}
