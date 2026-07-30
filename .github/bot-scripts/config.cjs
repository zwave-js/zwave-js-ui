// @ts-check

// Single source of truth for the repo-specific bot settings. The values
// live in ../zwave-js-bot.config.json so the same scripts can run in both
// zwave-js and zwave-js-ui; only the JSON differs between repos, this loader
// is byte-identical. Validation runs at require time and throws on a missing,
// unknown, or wrong-typed key, so a bad config fails the job loudly instead of
// silently changing what the bot does.

const fs = require("node:fs");
const path = require("node:path");

const CONFIG_PATH = path.join(__dirname, "..", "zwave-js-bot.config.json");

// Each node is either a group (`fields`) or a leaf (`type`). Groups reject
// unknown keys; `optional` groups may be absent entirely. `type` is matched
// against typeof, except "string[]" which requires a non-empty string array.
const SCHEMA = {
	fields: {
		bot: {
			fields: {
				login: { type: "string" },
				email: { type: "string" },
				name: { type: "string" },
			},
		},
		docs: {
			fields: {
				baseUrl: { type: "string" },
				questionCategorySlugs: { type: "string[]" },
			},
		},
		users: {
			fields: {
				authorized: { type: "string[]" },
			},
		},
		issues: {
			fields: {
				docsFeedbackTitle: { type: "string" },
			},
		},
		evalCases: {
			fields: {
				docsAnswers: { type: "string" },
				relatedPosts: { type: "string" },
			},
		},
		// Present in zwave-js-ui (redirects mis-filed issues to the driver
		// repo); absent in zwave-js, which is that repo
		redirects: {
			optional: true,
			fields: {
				issueTracker: { type: "string" },
			},
		},
	},
};

/** @param {string} p */
function label(p) {
	return p === "" ? "config root" : `config key "${p}"`;
}

/**
 * @param {any} node
 * @param {any} value
 * @param {string} p Dotted path of the value being checked
 */
function validate(node, value, p) {
	if (node.fields) {
		if (
			typeof value !== "object" || value === null || Array.isArray(value)
		) {
			throw new Error(`${label(p)} must be an object`);
		}
		const known = new Set(Object.keys(node.fields));
		for (const key of Object.keys(value)) {
			if (!known.has(key)) {
				throw new Error(
					`Unknown ${label(p === "" ? key : `${p}.${key}`)}`,
				);
			}
		}
		for (const [key, child] of Object.entries(node.fields)) {
			const childPath = p === "" ? key : `${p}.${key}`;
			if (!Object.prototype.hasOwnProperty.call(value, key)) {
				if (child.optional) continue;
				throw new Error(`Missing ${label(childPath)}`);
			}
			validate(child, value[key], childPath);
		}
		return;
	}
	if (node.type === "string[]") {
		const ok = Array.isArray(value)
			&& value.length > 0
			&& value.every((v) => typeof v === "string" && v.length > 0);
		if (!ok) {
			throw new Error(`${label(p)} must be a non-empty array of strings`);
		}
		return;
	}
	if (typeof value !== node.type) {
		throw new Error(`${label(p)} must be a ${node.type}`);
	}
	if (node.type === "string" && value.length === 0) {
		throw new Error(`${label(p)} must not be empty`);
	}
}

/** @param {string} text Raw JSON, exposed for the round-trip test */
function loadConfig(text) {
	let parsed;
	try {
		parsed = JSON.parse(text);
	} catch (e) {
		throw new Error(`Invalid JSON in ${CONFIG_PATH}: ${e.message}`);
	}
	validate(SCHEMA, parsed, "");
	return parsed;
}

const config = loadConfig(fs.readFileSync(CONFIG_PATH, "utf8"));

// Users whose posts the bots never react to: the authorized maintainers (who
// don't need automated answers or triage) plus the bot's own account
const excludedUsers = [...config.users.authorized, config.bot.login];

module.exports = {
	config,
	excludedUsers,
	loadConfig,
};
