// @ts-check

/// <reference path="types.d.ts" />

// Posts (or removes) the wrong-repository feedback comment based on the
// classification the agentic workflow reported via its safe-output job.

const fs = require("node:fs/promises");
const classifyIssueFeedback = require("./classifyIssueFeedback.cjs");

const VALID_CLASSIFICATIONS = ["UI", "driver", "unknown"];

/**
 * Expects the following environment variables:
 * - GH_AW_AGENT_OUTPUT: path to the agent output file containing the
 *   classification
 *
 * @param {{github: Github, context: Context}} param
 */
async function main(param) {
	const agentOutput = JSON.parse(
		await fs.readFile(
			/** @type {string} */ (process.env.GH_AW_AGENT_OUTPUT),
			"utf8",
		),
	);
	const item = (agentOutput.items ?? []).find(
		(/** @type {any} */ item) => item.type === "post_classification",
	);
	if (!item) {
		console.log("The agent did not report a classification, skipping");
		return;
	}

	// The model output is untrusted, treat anything unexpected like an
	// uncertain classification
	let classification = String(item.classification ?? "").trim();
	if (!VALID_CLASSIFICATIONS.includes(classification)) {
		console.log(
			`Unexpected classification ${
				JSON.stringify(classification)
			}, treating it as unknown`,
		);
		classification = "unknown";
	}
	console.log("Classification:", classification);

	await classifyIssueFeedback(param, classification);
}

module.exports = main;
