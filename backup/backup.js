/**
 * Backup tweets via Twitter API.
 */

var _         = require('underscore'),
	twitter   = require('twitter'),
	bigInt    = require('big-integer'),
	config    = require('../lib/config.js').twitter,
	util      = require('../lib/util-uber.js'),
	twitUtil  = require('../lib/util-twitter.js'),
	couch     = require('../database/couchdb.js'),
	db        = couch.db,
	soopahviv = new twitter(config);

exports.backupRelatedEntities = backupRelatedEntities;
exports.saveOrUpdateUser = saveOrUpdateUser;
exports.saveToBackupQueue = saveToBackupQueue;

/**
 * [When complete...]
 * Executes full backup of timeline, mentions, direct messages, and related objects.
 */
exports.run = function () {
	if (couch.dbReady) {
		backup();
	} else {
		couch.on('dbReady', function () {
			backup();
		});
	}
};

/**
 * Start Twitter stream for backup.
 */
exports.stream = function () {
	if (couch.dbReady) {
		stream();
	} else {
		couch.on('dbReady', function() {
			stream();
		});
	}
}

/**
 * Opens connection to Twitter Streaming API and saves incoming data from stream.
 */
function stream () {
	var parameters = {
		replies : 'all'
	};
	soopahviv.stream(
		'user',
		parameters,
		function (stream) {
			stream.on('data', function (data) {
				console.log('twitter stream data: ' + util.inspect(data));
			});
			stream.on('error', function (error) {
				console.log('twitter stream error: ' + error.toString());
			});
			stream.on('end', function (response) {
				console.log('twitter stream ended: ' + util.inspect(response));
			});
			process.on('exit', function () {
				stream.destroy();
			});
		}
	);
}

/**
 * Run all backup methods.
 */
function backup () {
	backupUserTimeline(getBackupCallback('user timeline'));
	backupMentions(getBackupCallback('mentions'));
	backupFavorites(getBackupCallback('favorites'));
	backupDirectMessages('sent', getBackupCallback('sent direct messages'));
	backupDirectMessages('received', getBackupCallback('received direct messages'));
}

/**
 * Get callback for backupFromTwitter().
 *
 * getBackupCallback(type)
 */
function getBackupCallback (type) {
	return function (response) {
		if (response.error) {
			console.error(type + ' error: ' + 
				(response.error instanceof Error ? response.error.toString() : util.inspect(response.error)));
		}
		console.log(type + ' backup stats:')
		console.log(' fetched: ' + response.returnCount);
		console.log(' loaded: ' + response.saveCount);
		if (response.minId) {
			console.log(' minId: ' + response.minId);
		}
		console.log();
	}
}

/**
 * Backup user timeline.
 *
 * backupUserTimeline(callback)
 */
function backupUserTimeline (callback) {
	var parameters = {
		user_id : config.user_id_str,
		trim_user : true,
		count : 200,
		include_rts : true
	};
	backupFromTwitter('/statuses/user_timeline.json', parameters, 'tweet', callback);
}

/**
 * Backup mentions.
 *
 * backupMentions(callback)
 */
function backupMentions (callback) {
	var parameters = {
		count : 200,
		include_entities : true
	};
	backupFromTwitter('/statuses/mentions_timeline.json', parameters, 'tweet', callback);
}

/**
 * Backup favorites.
 *
 * backupFavorites(callback)
 */
function backupFavorites (callback) {
	var parameters = {
		user_id : config.user_id_str,
		count : 200
	};
	backupFromTwitter('/favorites/list.json', parameters, 'tweet', callback);
}

/**
 * Backup direct messages.
 *
 * backupDirectMessages(type, callback)

 * type: "sent" or "received"
 */
function backupDirectMessages (type, callback) {
	var parameters = {
		count : 200,
		skip_status : 1
	};
	if (type === 'sent') {
		backupFromTwitter('/direct_messages/sent.json', parameters, 'dm', callback);	
	} else if (type === 'received') {
		backupFromTwitter('/direct_messages.json', parameters, 'dm', callback);	
	} else {
		callback({ error : new Error('Must specify direct message backup type: "sent" / "received"') });
	}
}


// soopahviv.get(
// 	'/statuses/retweets/401527406457933824.json',
// 	function (tweets) {
// 		console.log(util.inspect(tweets, { depth : null }));
// 	}
// );

// function backupUserQueue () {
// 	userQueue = _.uniq(userQueue);
// 	soopahviv.post(
// 		'/users/lookup.json',
// 		{
// 			user_id : userQueue.join()
// 		},
// 		function (users) {
// 			if (users instanceof Error) {
// 				console.error('error fetching users: ' + users);
// 			} else {
// 				users.forEach(function (user) {
// 					saveOrUpdateUser(user);
// 				});
// 			}
// 		}
// 	);
// }

/**
 * Backup tweets from Twitter endpoint.
 *
 * backupFromTwitter(endpoint, parameters, type, [stats], callback)
 *
 * type: currently supports "tweet" or "dm" 
 *
 * callback(stats):
 * - stats.returnCount: number of tweets returned from twitter
 * - stats.saveCount: number of tweets saved
 * - stats.minId: id of oldest tweet saved
 * - stats.parameters: paremters sent with api request
 * - stats.error: error object if there was an error
 */
function backupFromTwitter (endpoint, parameters, type, stats, callback) {
	if (typeof stats == 'function') {
		callback = stats;
		stats = {
			returnCount : 0,
			saveCount : 0
		};
	}
	stats.parameters = parameters;
	soopahviv.get(
		endpoint,
		parameters,
		function (items) {
			if (items instanceof Error) {
				stats.error = items;
				callback(stats);
			} else {
				function saveNextItem () {
					var item = items.shift(),
						_id;
					if (item) {
						_id = twitUtil.getIdForType(item, type);
						util.removeEmptyProperties(item);
						if (item.user) {
							if (item.user.name) {
								saveOrUpdateUser(item.user);	
							}
							item.user = twitUtil.getTrimmedUser(item.user);
						}
						if (item.sender) {
							saveOrUpdateUser(item.sender);
							delete item.sender;
						}
						if (item.recipient) {
							saveOrUpdateUser(item.recipient);
							delete item.recipient;
						}
						item.type = type;
						db.put(_id, item, function (error, response) {
							if (error && error.error === 'conflict') {
								if (item.user && item.user.id_str === item.in_reply_to_user_id_str) {
									// this happens when user mentions themself
									saveNextItem();
								} else {
									overwriteBackup(_id, item, function (error, response) {
										if (error) {
											stats.error = error;
										}
										if (response === true) {
											saveNextItem();
										} else {
											callback(stats);
										}
									});
									
								}
							} else if (error) {
								stats.error = error;
								callback(stats);
							} else {
								stats.saveCount++;
								if (!stats.minId || stats.minId > item.id_str) {
									stats.minId = item.id_str;
								}
								backupRelatedEntities(item);
								saveNextItem();
							}
						});
					} else {
						parameters.max_id = bigInt(stats.minId).minus(1).toString();
						backupFromTwitter(endpoint, parameters, type, stats, callback);
					}
				}
				if (items.length > 0) {
					stats.returnCount += items.length;
					saveNextItem();
				} else {
					callback(stats);
				}
			}
		}
	);
}

/**
 * Overwrite backup document. Called when initial put fails from conflict.
 */
function overwriteBackup (_id, item, callback) {
	db.view(
		'backup/documents',
		{ key : _id },
		function (error, response) {
			if (error) {
				callback(error, response);
			} else if (!response || response.length === 0) {
				callback(null, false);
			} else {
				db.save(_id, item, function (error, response) {
					if (error) {
						callback(error, response);
					} else {
						callback(null, true);
					}
				});
			}
		}
	);
}

/**
 * Fetch and save a single new tweet.
 */
function backupTweet (id_str) {
	var _id = twitUtil.getTweetId(id_str);
	db.get(_id, function (error, doc) {
		if (error && error.error === 'not_found') {
			soopahviv.get(
				'/statuses/show/' + id_str,
				{
					include_my_retweet : true
				},
				function (tweet) {
					var user;
					if (tweet instanceof Error) {
						console.error('error fetching tweet ' + id_str + ': ' + tweet.toString());
					} else {
						user = tweet.user;
						tweet.user = twitUtil.getTrimmedUser(user);
						tweet.type = 'tweet';
						db.put(_id, tweet, function (error, response) {
							if (error) {
								console.error('error saving tweet ' + id_str + ': ' + util.inspect(error));
							}
						});
						db.saveOrUpdateUser(user);
					}
				}
			);
		}
	});
}

/**
 * Save or update full user JSON.
 * Strips status subdocument if present.
 *
 * saveOrUpdateUser(user)
 */
function saveOrUpdateUser (user) {
	var _id = twitUtil.getUserId(user);
	delete user.status;
	user.type = 'user';
	db.save(_id, user, function (error, response) {
		if (error && error.error !== 'conflict') {
			console.error('error saving user ' + _id + ': ' + util.inspect(error));
		}
	});
}

function backupRelatedEntities (tweet) {
	if (tweet.in_reply_to_status_id_str) {
		saveToBackupQueue(tweet.in_reply_to_status_id_str, 'tweet');
	}
	if (tweet.entities && tweet.entities.user_mentions) {
		tweet.entities.user_mentions.forEach(function (userMention) {
			saveToBackupQueue(userMention, 'user');
		});
	}
}

/**
 * Save id to shell document for future backup.
 *
 * saveToBackupQueue(entity, type)
 *
 * Accepted entity: object, id_str
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
function saveToBackupQueue (entity, type) {
	var doc = {
			type : type,
			id_str : typeof entity === 'string' ? entity : entity.id_str,
			screen_name : entity.screen_name,
			needsBackup : true
		};

	function saveBackupDocument (_id) {
		db.put(_id, doc, function (error, response) {
			if (error && error.error !== 'conflict') {
				console.error('error saving id ' + doc.id_str + ' to backup queue: ' + util.inspect(error));
			}
		});
	}

	if (doc.id_str) {
		db.get(
			twitUtil.getIdForType(doc.id_str, type),
			function (error, response) {
				if (error && error.error === 'not_found') {
					saveBackupDocument(twitUtil.getIdForType(doc.id_str, type));
				}
			}
		);
	} else if (type === 'user') {
		db.view(
			'users/screenName',
			{ key : entity.screen_name },
			function (error, response) {
				if (!response || response.length === 0) {
					saveBackupDocument(twitUtil.getIdForType(entity.screen_name, type));
					// TODO: processing screen_name-only users from queue need to delete and recreate with "_id":"user:{id}"
				}
			}
		);
	}
}