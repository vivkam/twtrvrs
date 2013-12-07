/**
 * Twitter-specific utilities.
 */

exports.getTrimmedUser = function(user) {
	return {
		id : user.id,
		id_str : user.id_str
	};
}