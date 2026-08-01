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

// Flat lists of every allowed dotted path and its expected type.
// "string[]" requires a non-empty array of non-empty strings.
const STRING_KEYS = [
	"bot.login",
	"bot.email",
	"bot.name",
	"docs.baseUrl",
	"issues.docsFeedbackTitle",
	"evalCases.docsAnswersFile",
	"evalCases.relatedPostsFile",
	"redirects.issueTracker",
];
const STRING_ARRAY_KEYS = [
	"docs.questionCategorySlugs",
	"users.authorized",
];
// Present in zwave-js-ui (redirects mis-filed issues to the driver
// repo); absent in zwave-js, which is that repo
const OPTIONAL_GROUPS = new Set(["redirects"]);

/**
 * @param {any} obj
 * @param {string} path Dotted path
 */
function get(obj, path) {
	let value = obj;
	for (const key of path.split(".")) {
		if (typeof value !== "object" || value === null) return undefined;
		value = value[key];
	}
	return value;
}

/** @param {any} parsed */
function validate(parsed) {
	if (
		typeof parsed !== "object" || parsed === null || Array.isArray(parsed)
	) {
		throw new Error(`config root must be an object`);
	}

	const allKeys = [...STRING_KEYS, ...STRING_ARRAY_KEYS];

	// Reject unknown keys at the group and leaf levels
	const allowedGroups = new Set(allKeys.map((k) => k.split(".")[0]));
	for (const [group, value] of Object.entries(parsed)) {
		if (!allowedGroups.has(group)) {
			throw new Error(`Unknown config key "${group}"`);
		}
		if (
			typeof value !== "object" || value === null || Array.isArray(value)
		) {
			throw new Error(`config key "${group}" must be an object`);
		}
		for (const key of Object.keys(value)) {
			const path = `${group}.${key}`;
			if (!allKeys.includes(path)) {
				throw new Error(`Unknown config key "${path}"`);
			}
		}
	}

	// Require every known key, skipping absent optional groups
	for (const path of allKeys) {
		const group = path.split(".")[0];
		if (OPTIONAL_GROUPS.has(group) && !(group in parsed)) continue;
		if (!(group in parsed)) {
			throw new Error(`Missing config key "${group}"`);
		}
		const value = get(parsed, path);
		if (value === undefined) {
			throw new Error(`Missing config key "${path}"`);
		}
		if (STRING_ARRAY_KEYS.includes(path)) {
			const ok = Array.isArray(value)
				&& value.length > 0
				&& value.every((v) => typeof v === "string" && v.length > 0);
			if (!ok) {
				throw new Error(
					`config key "${path}" must be a non-empty array of strings`,
				);
			}
		} else if (typeof value !== "string") {
			throw new Error(`config key "${path}" must be a string`);
		} else if (value.length === 0) {
			throw new Error(`config key "${path}" must not be empty`);
		}
	}
}

/** @param {string} text Raw JSON, exposed for tests */
function loadConfig(text) {
	let parsed;
	try {
		parsed = JSON.parse(text);
	} catch (e) {
		throw new Error(`Invalid JSON in ${CONFIG_PATH}: ${e.message}`);
	}
	validate(parsed);
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
