/**
 * Twitter-specific utilities.
 */

exports.getTrimmedUser = function (user) {
	return {
		id : user.id,
		id_str : user.id_str
	};
};

exports.getBackupId = function (thing) {
	return 'backup:' + getIdStr(thing);
};

exports.getMediaId = function (thing) {
	return 'media:' + getIdStr(thing);
}

exports.getUserId = function (thing) {
	return 'user:' + getIdStr(thing);
};

exports.getTweetId = function (thing) {
	return 'tweet:' + getIdStr(thing);
}

exports.getIdForType = function (type, thing) {
	if (type === 'tweet') {
		return exports.getTweetId(thing);
	} else if (type === 'user') {
		return exports.getUserId(thing);
	} else if (type === 'media') {
		return exports.getMediaId(thing);
	}
}

function getIdStr (thing) {
	return typeof thing === 'object' ? (thing.id_str || '' + thing.id) : thing;
}