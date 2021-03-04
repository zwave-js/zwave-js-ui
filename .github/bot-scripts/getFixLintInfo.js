/// <reference path="types.d.ts" />
// @ts-check

/**
 * @param {{github: Github, context: Context}} param
 */
async function main(param) {
	const { github, context } = param;

	const options = {
		owner: context.repo.owner,
		repo: context.repo.repo,
	};

	// Get PR info
	const { data: pull } = await github.pulls.get({
		...options,
		pull_number: context.issue.number,
	});
	const { data: checks } = await github.checks.listForRef({
		...options,
		ref: pull.head.sha,
	});
	// Find the correct check
	const lintCheck = checks.check_runs.find(
		(r) => r.conclusion === "failure" && r.name.startsWith("lint"),
	);
	if (!lintCheck) return undefined;

	const { data: job } = await github.actions.getJobForWorkflowRun({
		...options,
		job_id: lintCheck.id,
	});
	const {
		data: { artifacts },
	} = await github.actions.listWorkflowRunArtifacts({
		...options,
		// @ts-expect-error for some reason job is `never`
		run_id: job.run_id,
	});

	if (!artifacts.length) return undefined;

	const { url } = await github.actions.downloadArtifact({
		...options,
		artifact_id: artifacts[0].id,
		archive_format: "zip",
	});

	return {
		repoName: pull.head.repo.full_name,
		headRef: pull.head.ref,
		patchUrl: url,
	};
}
module.exports = main;
