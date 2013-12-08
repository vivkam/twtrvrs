/**
 * Backup tweets via Twitter API.
 */

var _           = require('underscore'),
	twitter     = require('twitter'),
	bigInt      = require('big-integer'),
	config      = require('./config.js').twitter,
	util        = require('./util-uber.js'),
	twitUtil    = require('./util-twitter.js'),
	couch       = require('./couchdb.js'),
	soopahviv   = new twitter(config),
	db;

couch.on('dbReady', function() {
	db = couch.db;
	backupUserTimeline(userTimelineCallback);
});

function userTimelineCallback (response) {
	if (response.error) {
		if (response.error instanceof Error) {
			console.error('error fetching user timeline: ' + response.error.toString());
		} else {
			console.error('error saving user timeline tweet: ' + util.inspect(response.error));
		}
		
	}
	console.log('user timeline backup stats:')
	console.log(' fetched: ' + response.returnCount);
	console.log(' loaded: ' + response.saveCount);
	console.log(' minId: ' + response.minId);
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
	backupFromTwitter('/statuses/user_timeline.json', parameters, callback);
}

/**
 * Backup mentions.
 *
 * backupMentions(callback)
 */
function backupMentions (callback) {
	var parameters = {
		count: 200,
		include_entities : true
	};
	backupFromTwitter('/statuses/mentions_timeline.json', parameters, callback);
}

// soopahviv.get(
// 	'/statuses/retweets/401527406457933824.json',
// 	function (tweets) {
// 		console.log(util.inspect(tweets, { depth : null }));
// 	}
// );

// function backupUserQueue() {
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
 * backupFromTwitter(endpoint, parameters, [stats], callback)
 *
 * callback(stats):
 * - stats.returnCount: number of tweets returned from twitter
 * - stats.saveCount: number of tweets saved
 * - stats.minId: id of oldest tweet saved
 * - stats.parameters: paremters sent with api request
 * - stats.error: error object if there was an error
 */
function backupFromTwitter (endpoint, parameters, stats, callback) {
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
		function (tweets) {
			if (tweets instanceof Error) {
				stats.error = tweets;
				callback(stats);
			} else {
				function saveNextTweet () {
					var tweet = tweets.shift(),
						_id,
						user;
					if (tweet) {
						_id = tweet.id_str;
						util.removeEmptyProperties(tweet);
						if (tweet.user.screen_name) {
							user = tweet.user;
							tweet.user = twitUtil.getTrimmedUser(user);
							saveOrUpdateUser(user);
						}
						db.put(_id, tweet, function (error, response) {
							if (error && error.error === 'conflict') {
								if (tweet.user.id_str === tweet.in_reply_to_user_id_str) {
									saveNextTweet();
								} else {
									callback(stats);	
								}
							} else if (error) {
								stats.error = error;
								callback(stats);
							} else {
								stats.saveCount++;
								if (!stats.minId || stats.minId > _id) {
									stats.minId = _id;
								}
								if (tweet.in_reply_to_status_id_str) {
									saveToBackupQueue(tweet.in_reply_to_status_id_str, 'tweet');
								}
								if (tweet.retweet_count > 0) {
									saveToBackupQueue(tweet.id_str, 'retweet');
								}
								if (tweet.entities && tweet.entities.user_mentions) {
									tweet.entities.user_mentions.forEach(function(userMention) {
										saveToBackupQueue(userMention.id_str, 'user');
									});
								}
								saveNextTweet();
							}
						});
					} else {
						console.log(stats.saveCount + ' tweets saved | minId : ' + stats.minId);
						parameters.max_id = bigInt(stats.minId).minus(1).toString();
						backupFromTwitter(endpoint, parameters, stats, callback);
					}
				}
				if (tweets.length > 0) {
					stats.returnCount += tweets.length;
					console.log(stats.returnCount + ' tweets fetched');
					saveNextTweet();
				} else {
					callback(stats);
				}
			}
		}
	);
}

/**
 * Fetch and save a single new tweet.
 */
function backupTweet (id) {
	db.get(id, function (error, doc) {
		if (error && error.error === 'not_found') {
			soopahviv.get(
				'/statuses/show/' + id,
				{
					include_my_retweet : true
				},
				function (tweet) {
					var user;
					if (tweet instanceof Error) {
						console.error('error fetching tweet ' + id + ': ' + tweet);
					} else {
						user = tweet.user;
						tweet.user = twitUtil.getTrimmedUser(user);
						db.save(id, tweet, function (error, response) {
							if (error) {
								console.error('error saving tweet ' + id + ': ' + error);
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
	delete user.status
	db.save(_id, user, function (error, response) {
		if (error) {
			console.error('error saving user ' + _id + ': ' + error);
		}
	});
}

/**
 * Save id to flagged document for future backup.
 * Document structure: { _id : "backup:{id}" , type : {type} , id_str : {id} }
 *
 * saveToBackupQueue(id_str, type)
 *
 * Accepted types: tweet, user
 */
function saveToBackupQueue (id_str, type) {
	var backup_id = 'backup:' + id_str,
		check_id;

	function saveBackupDocument() {
		db.save(backup_id, { type : type , id_str : id_str }, function (error, response) {
			if (error && error.error !== 'conflict') {
				console.error('error saving id ' + id_str + ' to backup queue: ' + util.inspect(error));
			}
		});
	}

	if (type === 'retweet') {
		saveBackupDocument();
	} else {
		check_id = type === 'user' ? twitUtil.getUserId(id_str) : id_str,
		db.get(check_id, function (error, doc) {
			if (error && error.error === 'not_found') {
				saveBackupDocument();
			}
		});
	}
}