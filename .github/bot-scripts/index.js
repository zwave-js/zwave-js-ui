module.exports = {
	fixLintOffer: (...args) => require("./fix-lint-offer")(...args),
	fixLintCheck: (...args) => require("./fix-lint-check")(...args),
	fixLintFeedback: (...args) => require("./fix-lint-feedback")(...args),
};
