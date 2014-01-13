/**
 * Read config file(s).
 */

var util = require('uber-util'),
	defaultConfig = require('../config-default.json'),
	customConfig,
	config;

try {
	customConfig = require('../config.json');
	config = util.merge(defaultConfig, customConfig);
} catch (error) {
	config = defaultConfig;
}

module.exports = config;