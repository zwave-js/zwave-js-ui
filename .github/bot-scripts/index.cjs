// Only the repo-specific classic bot scripts live here; the docs-answer,
// classification, index and eval pipeline comes from zwave-js/bot-workflows
module.exports = {
	checkAuthorized: (...args) => require("./checkAuthorized.cjs")(...args),
	hideTransferredComments: (...args) =>
		require("./hideTransferredComments.cjs")(...args),
	fixLintFeedback: (...args) => require("./fixLintFeedback.cjs")(...args),
	getFixLintInfo: (...args) => require("./getFixLintInfo.cjs")(...args),
	rebaseFeedback: (...args) => require("./rebaseFeedback.cjs")(...args),
	renameCommitGetPRInfo: (...args) =>
		require("./renameCommitGetPRInfo.cjs")(...args),
	renameCommitCheck: (...args) => require("./renameCommitCheck.cjs")(...args),
	renameCommitFeedback: (...args) =>
		require("./renameCommitFeedback.cjs")(...args),
};
