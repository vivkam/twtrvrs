/**
 * Twitter-specific utilities.
 */

exports.getTrimmedUser = function (user) {
	return {
		id : user.id,
		id_str : user.id_str ? user.id_str : '' + user.id
	};
};

exports.getDmId = function (thing) {
	return 'dm:' + getIdStr(thing);
}

exports.getMediaId = function (thing) {
	return 'media:' + getIdStr(thing);
}

exports.getTweetId = function (thing) {
	return 'tweet:' + getIdStr(thing);
}

exports.getUserId = function (thing) {
	return 'user:' + getIdStr(thing);
};

exports.getIdForType = function (thing, type) {
	if (type === 'dm') {
		return exports.getDmId(thing);
	} else if (type === 'media') {
		return exports.getMediaId(thing);
	} else if (type === 'tweet') {
		return exports.getTweetId(thing);
	} else if (type === 'user') {
		return exports.getUserId(thing);
	}
}

function getIdStr (thing) {
	return typeof thing === 'object' ? (thing.id_str || '' + thing.id) : thing;
}