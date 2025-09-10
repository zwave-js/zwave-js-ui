// @ts-check

/// <reference path="types.d.ts" />

const CLASSIFY_ISSUE_COMMENT_TAG = "<!-- CLASSIFY_ISSUE_COMMENT_TAG -->";

/**
 * @param {{github: Github, context: Context}} param
 * @param {string} feedback
 */
async function main(param, feedback) {
	const { github, context } = param;

	const user = context.payload.issue.user.login;

	let message = "";
	switch (feedback) {
		case "driver": {
			message = `👋 Hey @${user}!

It looks like you are trying to report an issue with the Z-Wave JS driver, not the UI.
If this is the case, please close this issue and open a one in the [Z-Wave JS repository](https://github.com/zwave-js/zwave-js/issues) instead.
`;
			break;
		}
		default:
			// Probably correct repo
			return;
	}

	const options = {
		owner: context.repo.owner,
		repo: context.repo.repo,
	};

	// When all is good, remove any existing comment
	if (message) {
		message += CLASSIFY_ISSUE_COMMENT_TAG;
	}

	// Existing comments are tagged with LOGFILE_COMMENT_TAG
	try {
		const { data: comments } = await github.rest.issues.listComments({
			...options,
			issue_number: context.issue.number,
		});
		const existing = comments.find(
			(c) =>
				c.user?.login === "zwave-js-bot"
				&& c.body?.includes(CLASSIFY_ISSUE_COMMENT_TAG),
		);
		if (existing) {
			if (message) {
				// Comment found, update it
				await github.rest.issues.updateComment({
					...options,
					comment_id: existing.id,
					body: message,
				});
			} else {
				// No need to have a comment, all is ok
				await github.rest.issues.deleteComment({
					...options,
					comment_id: existing.id,
				});
			}
			return;
		}
	} catch {
		// Ok make a new one maybe
	}

	if (message) {
		// Make a new one otherwise
		await github.rest.issues.createComment({
			...options,
			issue_number: context.issue.number,
			body: message,
		});
	}
}

module.exports = main;
