/**
 * Twitter entity persistence functions.
 */

var util     = require('uber-util'),
	twitUtil = require('../lib/util-twitter.js'),
	db       = require('../database/couchdb.js').db;

/**
 * Get yer exports here!
 */
exports.saveItem = saveItem;
exports.saveTweet = saveTweet;
exports.saveUser = saveUser;
exports.saveDirectMessage = saveDirectMessage;
exports.saveForBackup = saveForBackup;

/**
 * Save item of specified type.
 */
function saveItem (item, type, callback) {
	if (type === 'tweet') {
		saveTweet(item, callback);
	} else if (type === 'user') {
		saveUser(item, callback);
	} else if (type === 'dm') {
		saveDirectMessage(item, callback);
	} else {
		callback(new Error('Cannot save item of unknown type "' + type + '"'));
	}
}

/**
 * Save tweet. Mentions are tweets too.
 * If in backup queue, update document.
 */
function saveTweet (tweet, callback) {
	var _id = twitUtil.getTweetId(tweet);
	util.removeEmptyProperties(tweet);
	if (tweet.user) {
		if (tweet.user.name) {
			saveUser(tweet.user);	
		}
		tweet.user = twitUtil.getTrimmedUser(tweet.user);
	}
	if (tweet.in_reply_to_status_id_str) {
		saveForBackup(tweet.in_reply_to_status_id_str, 'tweet');
	}
	if (tweet.entities && tweet.entities.user_mentions) {
		tweet.entities.user_mentions.forEach(
			function (userMention) {
				saveForBackup(userMention, 'user');
			}
		);
	}	
	tweet.type = 'tweet';
	db.put(_id, tweet, function (error, response) {
		function doCallback () {
			if (error) {
				console.error('error saving ' + _id + ': ' + util.inspect(error));
			}
			if (callback) {
				callback(error, response);
			}
		}
		if (error && error.error === 'conflict') {
			db.get(_id, function (getError, document) {
				if (!getError && document && document.needsBackup) {
					db.save(_id, tweet, function (saveError, saveResponse) {
						error = saveError;
						doCallback();
					});
				} else {
					doCallback();
				}
			});
		} else {
			doCallback();
		}
	});
}

/**
 * Save direct message.
 * Updates sender and recipient users and strips from message.
 */
function saveDirectMessage (dm, callback) {
	var _id = twitUtil.getDmId(dm);
	util.removeEmptyProperties(dm);
	if (dm.sender) {
		saveUser(dm.sender);
		delete dm.sender;
	}
	if (dm.recipient) {
		saveUser(dm.recipient);
		delete dm.recipient;
	}
	dm.type = 'dm';
	db.put(_id, dm, function (error, response) {
		if (error) {
			console.error('error saving ' + _id + ': ' + util.inspect(error));
		}
		if (callback) {
			callback(error, response);
		}
	});
}

/**
 * Save or update full user JSON.
 * Strips status subdocument if present.
 */
function saveUser (user, callback) {
	var _id = twitUtil.getUserId(user);
	delete user.status;
	user.type = 'user';
	db.save(_id, user, function (error, response) {
		if (!error) {
			removeUserBackupDocument(user);
		} else if (error && error.error !== 'conflict') {
			console.error('error saving ' + _id + ': ' + util.inspect(error));
		}
		if (callback) {
			callback(error, response);
		}
	});
}

/**
 * Remove user backup document if _id is of format user:screen_name.
 */
function removeUserBackupDocument (user) {
	db.get(twitUtil.getUserId(user.screen_name), function (error, document) {
		if (document) {
			db.remove(
				document._id,
				document._rev,
				function (removeError, response) {
					if (removeError && removeError.error !== 'not_found') {
						console.error('error removing backup user document ' + document._id + ': ' + util.inspect(removeError));
					}
				}
			);
		}
	});
}

/**
 * Save id to shell document for future backup if it doesn't already exist.
 *
 * This function has no callback. Errors are directly logged and do not affect other activities in progress.
 *
 * Accepted item: object, id_str
 * Accepted type: tweet, user
 *
 * Backup queue document structure:
 * {
 *   _id         : "{type}:{id}",
 *   type        : "{type}",
 *   id_str      : "{id}",         // when present
 *   screen_name : "{screen_name}" // if "type":"user"
 *   needsBackup : true            // backup flag
 * }
 */
function saveForBackup (item, type) {
	var doc = {
			type : type,
			id_str : typeof item === 'string' ? item : item.id_str,
			screen_name : item.screen_name,
			needsBackup : true
		};

	function saveBackupDocument (_id) {
		db.put(
			_id,
			doc,
			function (error, response) {
				if (error && error.error !== 'conflict') {
					console.error('error saving id ' + doc.id_str + ' to backup queue: ' + util.inspect(error));
				}
			}
		);
	}

	if (doc.id_str) {
		db.get(
			twitUtil.getIdForType(doc.id_str, type),
			function (error, document) {
				if (error && error.error === 'not_found') {
					saveBackupDocument(twitUtil.getIdForType(doc.id_str, type));
				}
			}
		);
	} else if (type === 'user') {
		db.view(
			'users/screenName',
			{ key : item.screen_name },
			function (error, response) {
				if (!response || response.length === 0) {
					saveBackupDocument(twitUtil.getIdForType(item.screen_name, type));
				}
			}
		);
	}
}
