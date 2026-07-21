// @ts-check

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import updateEvalTrackingIssue from "./updateEvalTrackingIssue.cjs";

const TITLE = "tracking title";

const context = {
	repo: { owner: "zwave-js", repo: "zwave-js-ui" },
	serverUrl: "https://github.com",
	runId: 42,
};

/** Records every write the script attempts against a given set of issues */
function githubWith(issues) {
	const calls = [];
	return {
		calls,
		github: {
			paginate: async () => issues,
			rest: {
				issues: {
					listForRepo: {},
					create: async (a) => calls.push({ op: "create", ...a }),
					update: async (a) => calls.push({ op: "update", ...a }),
					createComment: async (a) =>
						calls.push({ op: "comment", ...a }),
				},
			},
		},
	};
}

const run = (issues) => {
	const m = githubWith(issues);
	return updateEvalTrackingIssue({ github: m.github, context }).then(
		() => m.calls,
	);
};

describe("updateEvalTrackingIssue", () => {
	const saved = { ...process.env };

	beforeEach(() => {
		process.env.TRACKING_ISSUE_TITLE = TITLE;
		process.env.EVAL_NAME = "answer bot index restore";
	});

	afterEach(() => {
		process.env = { ...saved };
	});

	describe("TRACKING_ISSUE_BODY", () => {
		it("replaces the generated eval body", async () => {
			process.env.EVAL_OUTCOME = "failure";
			process.env.TRACKING_ISSUE_BODY = "the index could not be restored";

			const [created] = await run([]);
			expect(created.op).toBe("create");
			expect(created.title).toBe(TITLE);
			expect(created.body).toContain("the index could not be restored");
			expect(created.body).not.toContain("hit rate");
			// The run link is appended for every caller
			expect(created.body).toContain("/actions/runs/42");
		});

		it("leaves the eval body alone when unset", async () => {
			process.env.EVAL_OUTCOME = "failure";
			process.env.EVAL_SUMMARY = "hit rate 40%";

			const [created] = await run([]);
			expect(created.body).toContain("did not meet the required hit rate");
			expect(created.body).toContain("hit rate 40%");
		});
	});

	describe("TRACKING_ISSUE_QUIET", () => {
		it("does not comment again on an already-open issue", async () => {
			process.env.EVAL_OUTCOME = "failure";
			process.env.TRACKING_ISSUE_QUIET = "true";

			const calls = await run([
				{ title: TITLE, state: "open", number: 7 },
			]);
			expect(calls).toEqual([]);
		});

		it("still reopens and explains a closed issue", async () => {
			process.env.EVAL_OUTCOME = "failure";
			process.env.TRACKING_ISSUE_QUIET = "true";
			process.env.TRACKING_ISSUE_BODY = "outage";

			const calls = await run([
				{ title: TITLE, state: "closed", number: 7 },
			]);
			expect(calls.map((c) => c.op)).toEqual(["update", "comment"]);
			expect(calls[0].state).toBe("open");
			expect(calls[1].body).toContain("outage");
		});

		it("comments on an already-open issue when unset", async () => {
			process.env.EVAL_OUTCOME = "failure";

			const calls = await run([
				{ title: TITLE, state: "open", number: 7 },
			]);
			expect(calls.map((c) => c.op)).toEqual(["comment"]);
		});
	});

	describe("recovery", () => {
		it("closes an open issue and names the caller, not 'the evaluation'", async () => {
			process.env.EVAL_OUTCOME = "success";
			process.env.TRACKING_ISSUE_QUIET = "true";

			const calls = await run([
				{ title: TITLE, state: "open", number: 7 },
			]);
			expect(calls.map((c) => c.op)).toEqual(["comment", "update"]);
			expect(calls[0].body).toContain(
				"The answer bot index restore is healthy again",
			);
			expect(calls[1].state).toBe("closed");
		});

		it("does nothing when there is no tracking issue", async () => {
			process.env.EVAL_OUTCOME = "success";

			expect(await run([])).toEqual([]);
		});
	});

	it("refuses to run without a title", async () => {
		delete process.env.TRACKING_ISSUE_TITLE;
		process.env.EVAL_OUTCOME = "failure";

		await expect(run([])).rejects.toThrow("TRACKING_ISSUE_TITLE");
	});
});
