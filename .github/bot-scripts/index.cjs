module.exports = {
	checkAuthorized: (...args) => require("./checkAuthorized.cjs")(...args),
	classifyIssueFeedback: (...args) =>
		require("./classifyIssueFeedback.cjs")(...args),
	fixLintFeedback: (...args) => require("./fixLintFeedback.cjs")(...args),
	getFixLintInfo: (...args) => require("./getFixLintInfo.cjs")(...args),
	rebaseFeedback: (...args) => require("./rebaseFeedback.cjs")(...args),
	renameCommitGetPRInfo: (...args) =>
		require("./renameCommitGetPRInfo.cjs")(...args),
	renameCommitCheck: (...args) => require("./renameCommitCheck.cjs")(...args),
	renameCommitFeedback: (...args) =>
		require("./renameCommitFeedback.cjs")(...args),
	answerFromDocs: (...args) => require("./answerFromDocs.cjs")(...args),
	updatePostsIndex: (...args) => require("./updatePostsIndex.cjs")(...args),
	updateEvalTrackingIssue: (...args) =>
		require("./updateEvalTrackingIssue.cjs")(...args),
};
