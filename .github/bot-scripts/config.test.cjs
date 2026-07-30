// @ts-check

import { describe, expect, it } from "vitest";
import { config, excludedUsers, loadConfig } from "./config.cjs";

// config.cjs loads and validates this repo's zwave-js-bot.config.json at
// import time, so a bad file already throws before these run. The cases below
// pin the schema itself: they exercise loadConfig with the real config and
// with deliberately broken copies of it.

/** @param {object} overrides Shallow-merged onto a deep copy of the config */
function withConfig(overrides) {
	return JSON.stringify({ ...structuredClone(config), ...overrides });
}

describe("bot config", () => {
	it("round-trips this repo's config through the loader", () => {
		expect(loadConfig(JSON.stringify(config))).toEqual(config);
	});

	it("exposes the required keys with the right types", () => {
		expect(typeof config.bot.login).toBe("string");
		expect(typeof config.bot.email).toBe("string");
		expect(typeof config.bot.name).toBe("string");
		expect(typeof config.docs.baseUrl).toBe("string");
		expect(config.docs.questionCategorySlugs.length).toBeGreaterThan(0);
		expect(config.users.authorized.length).toBeGreaterThan(0);
		expect(typeof config.issues.docsFeedbackTitle).toBe("string");
		expect(typeof config.evalCases.docsAnswers).toBe("string");
		expect(typeof config.evalCases.relatedPosts).toBe("string");
	});

	it("derives excludedUsers as the authorized users plus the bot", () => {
		expect(excludedUsers).toEqual([
			...config.users.authorized,
			config.bot.login,
		]);
	});

	it("rejects a missing required key", () => {
		expect(() => loadConfig(JSON.stringify({}))).toThrow(
			/Missing config key "bot"/,
		);
	});

	it("rejects an unknown key", () => {
		expect(() => loadConfig(withConfig({ somethingElse: true }))).toThrow(
			/Unknown config key "somethingElse"/,
		);
	});

	it("rejects a wrong-typed value", () => {
		const bad = structuredClone(config);
		bad.docs.baseUrl = 42;
		expect(() => loadConfig(JSON.stringify(bad))).toThrow(
			/config key "docs\.baseUrl" must be a string/,
		);
	});

	it("rejects an empty string array", () => {
		const bad = structuredClone(config);
		bad.users.authorized = [];
		expect(() => loadConfig(JSON.stringify(bad))).toThrow(
			/config key "users\.authorized" must be a non-empty array of strings/,
		);
	});

	it("allows the optional redirects group to be absent", () => {
		const bad = structuredClone(config);
		delete bad.redirects;
		expect(loadConfig(JSON.stringify(bad)).redirects).toBeUndefined();
	});
});
