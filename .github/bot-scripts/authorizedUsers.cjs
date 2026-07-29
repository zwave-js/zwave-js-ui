/** This module defines which users are authorized to give the bot commands */

const authorizedUsers = ["AlCalzone", "robertsLando", "blhoward2"];

// Users whose posts the bots never react to: maintainers (who don't
// need automated answers or triage) and the bot's own account
const excludedUsers = [...authorizedUsers, "zwave-js-bot"];

module.exports = {
	authorizedUsers,
	excludedUsers,
};
