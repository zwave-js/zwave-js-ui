var debug = require('debug');

debug.enable('z2m:*');
debug = debug('z2m');

debug.log = console.log.bind(console);

module.exports = function(namespace){ return debug.extend(namespace)};
