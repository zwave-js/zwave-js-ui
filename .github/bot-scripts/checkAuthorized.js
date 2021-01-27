/// <reference path="types.d.ts" />
// @ts-check

const { authorizedUsers } = require("./authorizedUsers");

/**
 * @param {{github: Github, context: Context}} param
 */
async function main(param) {
	const { github, context } = param;
	const options = {
		owner: context.repo.owner,
		repo: context.repo.repo,
	};

	// console.log(`context.payload.issue:`);
	// console.dir(context.payload.issue);

	let isAuthorized;
	const user = context.payload.comment.user.login;

	if (context.payload.issue.html_url.includes("/pull/")) {
		console.log("Comment appears in a PR, retrieving PR info...");
		// Only the pull request author and authorized users may execute this command
		const { data: pull } = await github.pulls.get({
			...options,
			pull_number: context.payload.issue.number,
		});

		const allowed = [...authorizedUsers, pull.user.login];
		console.log(`Authorized users: ${allowed.join(", ")}`);
		console.log(`Commenting user: ${user}`);
		isAuthorized = allowed.includes(user);
		console.log(`Is authorized: ${isAuthorized}`);
	} else {
		// In issues, only the authorized users may execute any commands
		console.log("Comment appears in an issue");

		console.log(`Authorized users: ${authorizedUsers.join(", ")}`);
		console.log(`Commenting user: ${user}`);
		isAuthorized = authorizedUsers.includes(user);
		console.log(`Is authorized: ${isAuthorized}`);
	}

	if (isAuthorized) {
		// Let the user know we're working on it
		await github.reactions.createForIssueComment({
			...options,
			comment_id: context.payload.comment.id,
			content: "rocket",
		});
	} else {
		// Let the user know he can't do that
		await github.issues.createComment({
			...options,
			issue_number: context.payload.issue.number,
			body: `Sorry ${user}, you're not authorized to do that 🙁!`,
		});
	}
	return isAuthorized;
}
module.exports = main;