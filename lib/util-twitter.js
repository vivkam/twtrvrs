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

exports.getUserId = function (thing) {
	return 'user:' + getIdStr(thing);
};

exports.getMediaId = function (thing) {
	return 'media:' + getIdStr(thing);
}

exports.getIdForType = function (type, thing) {
	if (type === 'tweet') {
		return getIdStr(thing);
	} else if (type === 'user') {
		return exports.getUserId(thing);
	} else if (type === 'media') {
		return exports.getMediaId(thing);
	}
}

function getIdStr (thing) {
	return typeof thing === 'object' ? thing.id_str : thing;
}