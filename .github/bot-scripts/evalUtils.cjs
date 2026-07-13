// @ts-check

// Shared result logging and reporting for the retrieval-quality
// eval scripts

const fs = require("node:fs/promises");

/**
 * @typedef {{title: string, expected: string[], retrieved: string[]}} EvalResult
 */

/**
 * Logs the result of a single eval case
 * @param {boolean} hit
 * @param {EvalResult} result
 */
function logCase(hit, result) {
	if (hit) {
		console.log(`✅ ${result.title}`);
	} else {
		console.log(`❌ ${result.title}`);
		console.log(`   expected one of: ${result.expected.join(", ")}`);
		console.log(`   retrieved: ${result.retrieved.join(", ")}`);
	}
}

/**
 * Prints the hit rate, writes the summary the workflow includes in the
 * tracking issue, and exits with code 1 when the hit rate is below the floor
 * @param {number} numResults
 * @param {number} total Number of evaluated cases
 * @param {EvalResult[]} failures
 * @param {number} minHitRate
 */
async function reportResults(numResults, total, failures, minHitRate) {
	const hits = total - failures.length;
	const hitRate = hits / total;
	console.log(
		`\nhit@${numResults}: ${hits}/${total} (${
			(hitRate * 100).toFixed(1)
		}%), required: ${(minHitRate * 100).toFixed(1)}%`,
	);

	if (process.env.GITHUB_OUTPUT) {
		const summary = [
			`hit@${numResults}: ${hits}/${total} (${
				(hitRate * 100).toFixed(1)
			}%)`,
			...failures.map((f) =>
				`- ❌ ${f.title}\n  - expected one of: ${
					f.expected.join(", ")
				}\n  - retrieved: ${f.retrieved.join(", ")}`
			),
		].join("\n");
		await fs.appendFile(
			process.env.GITHUB_OUTPUT,
			`summary<<EOF\n${summary}\nEOF\n`,
		);
	}

	if (hitRate < minHitRate) {
		process.exit(1);
	}
}

module.exports = {
	logCase,
	reportResults,
};
