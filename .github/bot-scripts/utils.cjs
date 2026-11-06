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

module.exports = {
	lastTransferTime,
};
