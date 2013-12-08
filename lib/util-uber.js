/**
 * Various utility functions on top of Node.js util.
 */

var util  = require('util'),
	merge = require('deepmerge');

module.exports = util;
util.merge = merge;

util.removeEmptyProperties = function (thing) {
	if (util.isArray(thing)) {
		thing.forEach(function (item) {
			util.removeEmptyProperties(item);
		});
	} else if (typeof thing === 'object') {
		for (var property in thing) {
			if (thing[property] == null || (util.isArray(thing[property]) && thing[property].length === 0)) {
				delete thing[property];
			} else if (typeof thing[property] === 'object') {
				util.removeEmptyProperties(thing[property]);
				if (Object.keys(thing[property]).length === 0) {
					delete thing[property];
				}
			}
		}
	}
};
