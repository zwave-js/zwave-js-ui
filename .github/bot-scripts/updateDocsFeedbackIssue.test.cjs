// @ts-check

import { describe, it, expect } from "vitest";
import {
	codeFence,
	renderEvalCase,
	joinWithinBudget,
	ISSUE_LABEL,
} from "./updateDocsFeedbackIssue.cjs";

describe("updateDocsFeedbackIssue", () => {
	describe("ISSUE_LABEL", () => {
		it("is the docs-feedback label", () => {
			expect(ISSUE_LABEL).toBe("docs-feedback");
		});
	});

	describe("codeFence", () => {
		it("picks a minimal triple-backtick fence for content with no backticks", () => {
			expect(codeFence("plain content")).toBe("```");
		});

		it("picks a fence longer than a triple-backtick run in the content", () => {
			expect(codeFence("has ``` in it")).toBe("````");
		});

		it("picks a fence longer than the longest backtick run, not just the first", () => {
			expect(codeFence("short ``` then longer `````` run")).toBe(
				"```````",
			);
		});
	});

	describe("renderEvalCase", () => {
		it("produces a fence the embedded JSON cannot prematurely close", () => {
			const record = {
				question:
					'Question containing a fenced code block:\n```js\nconsole.log("```")\n```\nplease help',
				sections: ["docs/a.md#b"],
			};
			const rendered = renderEvalCase(record);
			// Extract the opening fence line and confirm no unescaped
			// occurrence of that exact fence string appears inside the
			// JSON body (only the intended open/close lines)
			const fenceMatch = rendered.match(/^(`+)json$/m);
			expect(fenceMatch).not.toBeNull();
			const fence = /** @type {RegExpMatchArray} */ (fenceMatch)[1];
			const occurrences = rendered.split(fence).length - 1;
			// Exactly the opening and closing fence, nothing in between
			expect(occurrences).toBe(2);
		});

		it("truncates the question to the configured max length", () => {
			const record = {
				question: "x".repeat(1000),
				sections: [],
			};
			const rendered = renderEvalCase(record);
			const json = JSON.parse(
				/** @type {RegExpMatchArray} */ (rendered.match(
					/```+json\n([\s\S]*?)\n```+/,
				))[1],
			);
			expect(json.question.length).toBeLessThanOrEqual(300);
		});

		it("dedupes expectedFiles derived from sections", () => {
			const record = {
				question: "q",
				sections: ["docs/a.md#one", "docs/a.md#two", "docs/b.md#x"],
			};
			const rendered = renderEvalCase(record);
			const json = JSON.parse(
				/** @type {RegExpMatchArray} */ (rendered.match(
					/```+json\n([\s\S]*?)\n```+/,
				))[1],
			);
			expect(json.expectedFiles).toEqual(["docs/a.md", "docs/b.md"]);
		});
	});

	describe("joinWithinBudget", () => {
		it("includes everything when under budget", () => {
			const entries = ["a", "b", "c"];
			expect(joinWithinBudget(entries, 1000)).toBe("a\n\nb\n\nc");
		});

		it("omits all entries if the first entry exceeds the budget", () => {
			const entries = ["x".repeat(500), "SECOND_ENTRY_SENTINEL"];
			const result = joinWithinBudget(entries, 10);
			expect(result).not.toContain("x".repeat(500));
			expect(result).not.toContain("SECOND_ENTRY_SENTINEL");
			expect(result).toContain("and 2 more");
		});

		it("truncates and appends a summary note when entries exceed the budget", () => {
			const entries = ["a".repeat(50), "b".repeat(50), "c".repeat(50)];
			const result = joinWithinBudget(entries, 60);
			expect(result).toContain("omitted");
			expect(result).not.toContain("c".repeat(50));
		});

		it("never produces a result exceeding the budget plus the summary note", () => {
			const entries = Array.from({ length: 20 }, (_, i) =>
				`entry-${i}-`.repeat(20));
			const result = joinWithinBudget(entries, 500);
			// The included entries portion (before any summary note) must
			// respect the budget
			const withoutNote = result.split("\n\n_...and")[0];
			expect(withoutNote.length).toBeLessThanOrEqual(500 + entries[0].length);
		});

		it("keeps a strict priority prefix", () => {
			const result = joinWithinBudget(
				["A".repeat(100), "B".repeat(200), "C".repeat(5)],
				120,
			);
			expect(result).toContain("A".repeat(100));
			expect(result).not.toContain("B".repeat(200));
			expect(result).not.toContain("CCCCC");
			expect(result).toContain("and 2 more");
		});
	});
});
