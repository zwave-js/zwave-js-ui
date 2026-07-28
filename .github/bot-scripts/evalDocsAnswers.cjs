// @ts-check

// Evaluates the retrieval quality of the docs answer bot against a
// golden set of questions with known relevant documentation files.
// Run daily in CI to catch regressions from docs restructuring or
// changes to the chunking/retrieval logic.
//
// Usage: node evalDocsAnswers.cjs <index-file>

const fs = require("node:fs/promises");
const path = require("node:path");
const { loadDocsIndex, retrieve } = require("./docsIndex.cjs");
const { logCase, reportResults } = require("./evalUtils.cjs");
const { embed, indexMatchesModel } = require("./localEmbeddings.cjs");

const NUM_RESULTS = 5;
// Allow a small number of misses before failing, retrieval is not exact
const MIN_HIT_RATE = Number(process.env.MIN_HIT_RATE || "0.9");

async function main() {
	const [indexFile] = process.argv.slice(2);
	if (!indexFile) {
		console.error("Usage: node evalDocsAnswers.cjs <index-file>");
		process.exit(1);
	}

	const index = await loadDocsIndex(indexFile);
	if (!index) {
		console.error(
			`No valid docs index found at ${indexFile} (missing, wrong version, or malformed)`,
		);
		process.exit(1);
	}
	if (!indexMatchesModel(index, "docs index")) process.exit(1);
	/** @type {{question: string, expectedFiles: string[]}[]} */
	const cases = JSON.parse(
		await fs.readFile(
			path.join(__dirname, "docsAnswersEvalCases.json"),
			"utf8",
		),
	);

	// A hit rate over zero cases is meaningless, and embed([]) would be
	// a wasted/malformed request - fail loudly instead of silently
	// "passing" an empty eval (see also reportResults()'s own guard)
	if (cases.length === 0) {
		throw new Error(
			"No eval cases found in docsAnswersEvalCases.json - cannot evaluate retrieval quality",
		);
	}

	const embeddings = await embed(cases.map((c) => c.question));

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
	}

	await reportResults(NUM_RESULTS, cases.length, failures, MIN_HIT_RATE);
}

if (require.main === module) {
	main().catch((e) => {
		console.error(e);
		process.exit(1);
	});
}
