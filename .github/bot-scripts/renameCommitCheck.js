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

	const request = {
		...options,
		pull_number: context.issue.number,
	};
	const { data: commits } = await github.pulls.listCommits({
		...options,
		pull_number: context.issue.number,
	});

	if (commits.length > 1) {
		// Not necessary to do this.
		await github.issues.createComment({
			...options,
			issue_number: context.payload.issue.number,
			body: `There is more than one commit - no need to rename it.`,
		});

		return false;
	}
	return true;
}
module.exports = main;
