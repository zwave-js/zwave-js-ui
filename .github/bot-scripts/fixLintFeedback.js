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
		feedbackText = `🔨 I tried my best, but unfortunately some lint errors require manual attention.`;
	} else if (process.env.FEEDBACK === "unchanged") {
		feedbackText = `😕 Sorry, I couldn't do anything here.`;
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
