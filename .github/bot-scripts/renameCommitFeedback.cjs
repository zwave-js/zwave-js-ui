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

	let feedbackText;
	if (process.env.FEEDBACK === "error") {
		feedbackText = `❌ Sorry, I could not edit the commit message.`;
	} else if (process.env.FEEDBACK === "success") {
		feedbackText = `🎉 Commit message edited.
When working locally, make sure to hard-reset your local branch to include the changed commit.`;
	} else {
		return;
	}

	await github.issues.createComment({
		...options,
		issue_number: context.payload.issue.number,
		body: feedbackText,
	});
}
module.exports = main;
