// @ts-check

/// <reference path="types.d.ts" />

// Posts the wrong-repository feedback comment based on the
// classification the agentic workflow reported via its safe-output job.

const fs = require("node:fs/promises");
const classifyIssueFeedback = require("./classifyIssueFeedback.cjs");

const VALID_CLASSIFICATIONS = ["ui", "driver", "unknown"];

/**
 * Expects the following environment variables:
 * - GH_AW_AGENT_OUTPUT: path to the agent output file containing the
 *   classification
 *
 * @param {{github: Github, context: Context}} param
 */
async function main(param) {
	// The agent artifact is downloaded with continue-on-error, so a
	// missing or malformed output file is an anticipated state, not a
	// reason to fail the job red on a user-triggered run
	/** @type {any} */
	let agentOutput;
	try {
		agentOutput = JSON.parse(
			await fs.readFile(
				/** @type {string} */ (process.env.GH_AW_AGENT_OUTPUT),
				"utf8",
			),
		);
	} catch (e) {
		console.log(`::warning::Could not read the agent output: ${e.message}`);
		return;
	}
	const items = Array.isArray(agentOutput?.items) ? agentOutput.items : [];
	const item = items.find(
		(/** @type {any} */ item) => item?.type === "post_classification",
	);
	if (!item) {
		console.log("The agent did not report a classification, skipping");
		return;
	}

	// The model output is untrusted, treat anything unexpected like an
	// uncertain classification. Case and stray punctuation don't change
	// the verdict, so don't let them turn one into "unknown".
	let classification = String(item.classification ?? "")
		.trim()
		.replace(/[.!"']+$/, "")
		.toLowerCase();
	if (!VALID_CLASSIFICATIONS.includes(classification)) {
		console.log(
			`Unexpected classification ${
				JSON.stringify(item.classification)
			}, treating it as unknown`,
		);
		classification = "unknown";
	}
	console.log("Classification:", classification);

	await classifyIssueFeedback(param, classification);
}

module.exports = main;
