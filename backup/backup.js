/**
 * Backup tweets via Twitter API.
 */

var twitter   = require('twitter'),
	bigInt    = require('big-integer'),
	util      = require('uber-util'),
	persist   = require('./persist.js'),
	config    = require('../lib/config.js').twitter,
	twitUtil  = require('../lib/util-twitter.js'),
	couch     = require('../database/couchdb.js'),
	db        = couch.db,
	soopahviv = new twitter(config);

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
		couch.on('dbReady', function () {
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
					var item = items.shift();
					if (item) {
						persist.saveItem(item, type, function (error, response) {
							if (error && error.error === 'conflict') {
								if (item.user && item.user.id_str === item.in_reply_to_user_id_str) {
									// this happens when user mentions themself
									saveNextItem();
								} else {
									callback(stats);
								}
							} else if (error) {
								stats.error = error;
								callback(stats);
							} else {
								stats.saveCount++;
								if (!stats.minId || stats.minId > item.id_str) {
									stats.minId = item.id_str;
								}
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
