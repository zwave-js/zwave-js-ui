// @ts-check

/// <reference path="types.d.ts" />

// Posts the wrong-repository feedback comment based on the
// classification the agentic workflow reported via its safe-output job.

const { readAgentOutputItem } = require("./agentOutput.cjs");
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
	const item = await readAgentOutputItem("post_classification");
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
