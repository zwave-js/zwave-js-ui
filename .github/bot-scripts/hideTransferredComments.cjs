// @ts-check

/// <reference path="types.d.ts" />

const { config } = require("./config.cjs");
const { lastTransferTime } = require("./utils.cjs");

// Bot comments carry an HTML marker so they can be found again. The pattern
// also matches the tags used in zwave-js-ui, which are not known here.
const COMMENT_TAG_REGEX = /<!--\s*[A-Z0-9_]+_TAG\s*-->/;

/**
 * Collapses the bot comments an issue inherited from another repository.
 * They were written for the repo the issue came from, so their advice is
 * wrong here.
 *
 * @param {{github: Github, context: Context}} param
 */
async function main(param) {
	const { github, context } = param;

	if (!context.payload.issue) return;

	const options = {
		owner: context.repo.owner,
		repo: context.repo.repo,
	};
	const issue_number = context.payload.issue.number;

	const events = await github.paginate(
		github.rest.issues.listEventsForTimeline,
		{ ...options, issue_number, per_page: 100 },
	);
	const transferredAt = lastTransferTime(events);
	if (!transferredAt) {
		console.log("Issue was not transferred, nothing to hide");
		return;
	}

	const comments = await github.paginate(github.rest.issues.listComments, {
		...options,
		issue_number,
		per_page: 100,
	});
	// Transferred comments keep their original creation date
	const inherited = comments.filter(
		(c) =>
			new Date(c.created_at).getTime() < transferredAt
			&& c.user?.login === config.bot.login
			&& COMMENT_TAG_REGEX.test(c.body ?? ""),
	);
	console.log(`Hiding ${inherited.length} inherited bot comment(s)`);

	for (const comment of inherited) {
		try {
			await github.graphql(
				`
				mutation minimize($commentId: ID!) {
					minimizeComment(input: {
						subjectId: $commentId,
						classifier: OUTDATED
					}) {
						minimizedComment { isMinimized }
					}
				}
				`,
				{ commentId: comment.node_id },
			);
			console.log(`Hid comment ${comment.html_url}`);
		} catch (e) {
			console.log(`Failed to hide comment ${comment.html_url}: ${e}`);
		}
	}
}

module.exports = main;
module.exports.COMMENT_TAG_REGEX = COMMENT_TAG_REGEX;
