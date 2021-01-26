module.exports = {
	checkAuthorized: (...args) => require("./checkAuthorized")(...args),
	fixLintFeedback: (...args) => require("./fixLintFeedback")(...args),
	rebaseFeedback: (...args) => require("./rebaseFeedback")(...args),
	renameCommitGetPRInfo: (...args) =>
		require("./renameCommitGetPRInfo")(...args),
	renameCommitCheck: (...args) => require("./renameCommitCheck")(...args),
	renameCommitFeedback: (...args) =>
		require("./renameCommitFeedback")(...args),
	importConfigCreatePR: (...args) =>
		require("./importConfigCreatePR")(...args),
};
