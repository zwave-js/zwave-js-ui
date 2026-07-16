// @ts-check

import { describe, it, expect, afterEach } from "vitest";
import { reportResults } from "./evalUtils.cjs";

describe("evalUtils", () => {
	describe("reportResults", () => {
		const originalGithubOutput = process.env.GITHUB_OUTPUT;

		afterEach(() => {
			if (originalGithubOutput === undefined) {
				delete process.env.GITHUB_OUTPUT;
			} else {
				process.env.GITHUB_OUTPUT = originalGithubOutput;
			}
		});

		it("throws an explicit error for zero evaluated cases instead of silently passing", async () => {
			delete process.env.GITHUB_OUTPUT;
			await expect(reportResults(5, 0, [], 0.8)).rejects.toThrow(
				/no eval cases/i,
			);
		});

		it("does not exit the process for a passing hit rate", async () => {
			delete process.env.GITHUB_OUTPUT;
			// If this resolves without the test runner exiting, exit(1)
			// was not called - a genuine failing case would kill the
			// whole test process, so absence of that is the assertion
			await expect(reportResults(5, 4, [], 0.5)).resolves.toBeUndefined();
		});
	});
});
