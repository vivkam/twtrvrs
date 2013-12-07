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
	return 'backup:' + (typeof thing === 'object' ? thing.id_str : thing);
};

exports.getUserId = function (thing) {
	return 'user:' + (typeof thing === 'object' ? thing.id_str : thing);
};