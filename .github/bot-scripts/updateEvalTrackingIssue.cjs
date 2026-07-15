// @ts-check

/// <reference path="types.d.ts" />

// Opens, updates or closes a tracking issue based on the outcome of a
// daily retrieval-quality evaluation.
//
// Expects the following environment variables:
// - TRACKING_ISSUE_TITLE: exact title used to find and create the issue
// - EVAL_NAME: human-readable name of the evaluation for the issue body
// - EVAL_OUTCOME: the outcome of the evaluation step ("success"/"failure")
// - EVAL_SUMMARY: the summary output of the evaluation step. Only set
//   when the eval script ran to completion and reported a hit rate -
//   a failure with no summary means the script itself crashed (a
//   genuine Models API/network error, or e.g. zero eval cases), which
//   is an infrastructure problem rather than a retrieval quality miss
//   and is reported differently so it isn't mistaken for a docs gap.

/**
 * @param {{github: Github, context: Context}} param
 */
async function main(param) {
	const { github, context } = param;

	const title = process.env.TRACKING_ISSUE_TITLE;
	if (!title) {
		throw new Error("TRACKING_ISSUE_TITLE is not set");
	}
	const failed = process.env.EVAL_OUTCOME === "failure";
	const summary = process.env.EVAL_SUMMARY;
	// A summary is only ever written by reportResults() after it computed
	// a hit rate. Its absence on a failed run means the eval crashed
	// before getting that far.
	const isInfraFailure = failed && !summary;

	// Find an existing tracking issue, open or closed. Paginated since
	// this repo can accumulate more than one page of github-actions[bot]
	// issues over time (other scheduled workflows also open issues this way)
	const issues = await github.paginate(github.rest.issues.listForRepo, {
		...context.repo,
		creator: "github-actions[bot]",
		state: "all",
		per_page: 100,
	});
	const tracking = issues.find((i) => i.title === title);

	const runUrl =
		`${context.serverUrl}/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}`;
	const body = isInfraFailure
		? `The daily evaluation of the ${process.env.EVAL_NAME} failed to run to completion (an infrastructure error - e.g. a Models API/network failure - not a retrieval quality regression).

See the [workflow run](${runUrl}) for details.`
		: `The daily evaluation of the ${process.env.EVAL_NAME} did not meet the required hit rate.

${summary || "(no summary available)"}

See the [workflow run](${runUrl}) for details.`;

	if (failed) {
		if (!tracking) {
			await github.rest.issues.create({
				...context.repo,
				title,
				body,
			});
		} else if (tracking.state === "closed") {
			await github.rest.issues.update({
				...context.repo,
				issue_number: tracking.number,
				state: "open",
			});
			await github.rest.issues.createComment({
				...context.repo,
				issue_number: tracking.number,
				body,
			});
		} else {
			await github.rest.issues.createComment({
				...context.repo,
				issue_number: tracking.number,
				body,
			});
		}
	} else if (tracking && tracking.state === "open") {
		await github.rest.issues.createComment({
			...context.repo,
			issue_number: tracking.number,
			body:
				`The evaluation passed again in the latest [workflow run](${runUrl}). Closing.`,
		});
		await github.rest.issues.update({
			...context.repo,
			issue_number: tracking.number,
			state: "closed",
		});
	}
}

module.exports = main;
