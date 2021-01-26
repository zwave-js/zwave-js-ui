/// <reference path="types.d.ts" />

const { authorizedUsers } = require("./authorizedUsers");

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

	if (process.env.RESULT === "unchanged") {
		await github.issues.createComment({
			...options,
			issue_number: context.payload.issue.number,
			body: `❌ Sorry, importing the files yielded no changes.`,
		});
		return;
	}

	const pr = await github.pulls.create({
		...options,
		head: process.env.branchname,
		base: "master",
		title: process.env.commitmessage,
		body: `fixes: #${context.payload.issue.number}

**TODO:**
- [ ]	Change PR title to be more specific`,
		maintainer_can_modify: true,
	});
	const prNumber = pr.data.number;

	// Request review and add assignee
	await github.pulls.requestReviewers({
		...options,
		pull_number: prNumber,
		reviewers: authorizedUsers,
	});
	await github.issues.addAssignees({
		...options,
		issue_number: prNumber,
		assignees: authorizedUsers,
	});

	await github.issues.createComment({
		...options,
		issue_number: context.payload.issue.number,
		body: `🔨 I created a PR at #${prNumber} - check it out!`,
	});
}
module.exports = main;
