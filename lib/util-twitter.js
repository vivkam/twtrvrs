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

function getIdStr (thing) {
	return typeof thing === 'object' ? thing.id_str : thing;
}