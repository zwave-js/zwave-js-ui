/** This module defines which users are authorized to give the bot commands */

const { config, excludedUsers } = require("./config.cjs");

const authorizedUsers = config.users.authorized;

module.exports = {
	authorizedUsers,
	excludedUsers,
};
