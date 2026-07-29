// @ts-check

// Reads the typed output items a gh-aw safe-output job receives from
// the agent via the GH_AW_AGENT_OUTPUT file.

const fs = require("node:fs/promises");

/**
 * Returns the first agent-output item of the given type, or undefined
 * when the output is missing, malformed, or contains no such item.
 * The agent artifact is downloaded best-effort, so those are expected
 * states, not job failures.
 * @param {string} type
 * @returns {Promise<any | undefined>}
 */
async function readAgentOutputItem(type) {
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
		console.log(
			`::warning::Could not read the agent output: ${e.message}`,
		);
		return undefined;
	}
	const items = Array.isArray(agentOutput?.items) ? agentOutput.items : [];
	return items.find((/** @type {any} */ item) => item?.type === type);
}

module.exports = { readAgentOutputItem };
