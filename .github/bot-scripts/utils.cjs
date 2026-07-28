// @ts-check

/// <reference path="types.d.ts" />

/**
 * Returns when an issue was last transferred into this repository,
 * or 0 if it was created here.
 * @param {{event?: string, created_at?: string}[]} events - Timeline events
 * @returns {number} Epoch milliseconds
 */
function lastTransferTime(events) {
	let transferredAt = 0;
	for (const event of events) {
		if (event.event !== "transferred" || !event.created_at) continue;
		// Issues may be transferred repeatedly, only the last hop matters
		transferredAt = Math.max(
			transferredAt,
			new Date(event.created_at).getTime(),
		);
	}
	return transferredAt;
}

/**
 * Lists an issue's comments, ignoring those inherited from another repository.
 * Transferring an issue recreates the source repo's comments here with their
 * original creation date, so everything older than the last transfer was
 * written elsewhere.
 *
 * @param {Github} github
 * @param {string} owner
 * @param {string} repo
 * @param {number} issueNumber
 */
async function listCommentsSinceTransfer(github, owner, repo, issueNumber) {
	const comments = await github.paginate(github.rest.issues.listComments, {
		owner,
		repo,
		issue_number: issueNumber,
		per_page: 100,
	});
	// Without comments there is nothing to filter, save the timeline request
	if (comments.length === 0) return comments;

	const events = await github.paginate(
		github.rest.issues.listEventsForTimeline,
		{
			owner,
			repo,
			issue_number: issueNumber,
			per_page: 100,
		},
	);
	const transferredAt = lastTransferTime(events);
	if (!transferredAt) return comments;

	return comments.filter(
		(c) => new Date(c.created_at).getTime() > transferredAt,
	);
}

module.exports = {
	lastTransferTime,
	listCommentsSinceTransfer,
};
