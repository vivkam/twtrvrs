/**
 * CouchDB view definitions and creation functions.
 *
 * Model for _id property:
 * - tweets          : "tweet:{tweet_id_str}"
 * - users           : "user:{user_id_str}"
 * - direct messages : "dm:{media_id_str}"
 *
 * Every tweet/user/dm document has a "type" property. Possible values: tweet, user, dm
 *
 * Media is stored as tweet document attachments.
 */

var config = require('../lib/config.js').twitter;

exports.createViews = createViews;

/**
 * Creates views
 *
 * createViews(db, callback)
 *
 * callback(error, response)
 * - error: array of errors or null if no errors
 * - response: array of view creation responses
 */
function createViews (db, callback) {
	var errors = [],
		responses = [],
		viewCreators = [
			createTweetViews,
			createUserViews,
			createDirectMessageViews,
			createBackupQueueViews
		];
	function createNextView () {
		var viewCreator = viewCreators.shift();
		if (viewCreator) {
			viewCreator(
				db,
				function (error, response) {
					if (error) {
						errors.push(error);	
					}
					if (response) {
						responses.push(response);	
					}
					createNextView();
				}
			);
		} else {
			if (errors.length === 0) {
				errors = null;
			}
			callback(errors, responses);
		}
	}
	createNextView();
}

function createTweetViews (db, callback) {
	console.log('creating tweet views');
	db.save(
		'_design/tweets',
		{
			dateCreated : {
				map : function (doc) {
					if (doc.type === 'tweet' && !doc.needsBackup) {
						var date = new Date(doc.created_at);
						emit(date.toISOString(), null);
					}
				}
			},
			favorited : {
				map : getUserSpecificFunction(
					function (doc) {
						if (doc.type === 'tweet' && doc.favorite_count > 0 && doc.user.id_str === 'user_id_str') {
							var date = new Date(doc.created_at);
							emit(date.toISOString(), null);
						}
					}
				)
			},
			favorites : {
				map : function (doc) {
					if (doc.type === 'tweet' && doc.favorited) {
						var date = new Date(doc.created_at);
						emit(date.toISOString(), null);
					}
				}
			},
			hashtags : {
				map : function (doc) {
					if (doc.type === 'tweet' && doc.entities && doc.entities.hashtags) {
						doc.entities.hashtags.forEach(function (hashtag) {
							emit(hashtag.text, null);
						});
					}
				},
				reduce : function (key, value) {
					return value.length;
				}
			},
			media : {
				map : function (doc) {
					if (doc.type === 'tweet' && doc.entities && doc.entities.media) {
						doc.entities.media.forEach(function (media) {
							var hasAttachment = false;
							if (doc._attachments) {
								for (var attachment_id_str in doc._attachments) {
									if (attachment_id_str === media.id_str) {
										hasAttachment = true;
									}
								}
							}
							emit(media.id_str, {
								doc_id_str : doc.id_str,
								hasAttachment : hasAttachment
							});
						});
					}
				}
			},
			mentions : {
				map : function (doc) {
					if (doc.type === 'tweet' && doc.text.match(/@soopahviv/)) {
						var date = new Date(doc.created_at);
						emit(date.toISOString(), null);
					}
				}
			},
			retweeted : {
				map : getUserSpecificFunction(
					function (doc) {
						if (doc.type === 'tweet' && doc.retweet_count > 0 && doc.user.id_str === 'user_id_str') {
							var date = new Date(doc.created_at);
							emit(date.toISOString(), null);
						}
					}					
				)
			},
			retweets : {
				map : function (doc) {
					if (doc.type === 'tweet' && doc.retweeted) {
						var date = new Date(doc.created_at);
						emit(date.toISOString(), null);
					}
				}
			},
			symbols : {
				map : function (doc) {
					if (doc.type === 'tweet' && doc.entities && doc.entities.symbols) {
						doc.entities.symbols.forEach(function (symbol) {
							emit(symbol.text, doc._id);
						});
					}
				},
				reduce : function (key, value) {
					return value.length;
				}
			},
			tweeted : {
				map : function (doc) {
					if (doc.type === 'tweet' && doc.user && doc.user.id_str === '5981592') {
						var date = new Date(doc.created_at);
						emit(date.toISOString(), null);
					}
				}
			},
			urls : {
				map : function (doc) {
					if (doc.type === 'tweet' && doc.entities && doc.entities.urls) {
						doc.entities.urls.forEach(function (url) {
							emit(url.expanded_url ? url.expanded_url : url.url, doc._id);
						});
					}
				}
			}
		},
		callback
	);
}

function createUserViews (db, callback) {
	console.log('creating user views');
	db.save(
		'_design/users',
		{
			screenName : {
				map : function (doc) {
					if (doc.type === 'user' && !doc.needsBackup) {
						emit(doc.screen_name, doc._id);
					}
				}
			}
		},
		callback
	);
}

function createDirectMessageViews (db, callback) {
	console.log('creating direct message views');
	db.save(
		'_design/dm',
		{
			sender : {
				map : function (doc) {
					if (doc.type === 'dm') {
						emit(doc.sender_screen_name, doc._id);
					}
				},
				reduce : function (key, value) {
					return value.length;
				}
			},
			recipient : {
				map : function (doc) {
					if (doc.type === 'dm') {
						emit(doc.recipient_screen_name, doc._id);
					}
				},
				reduce : function (key, value) {
					return value.length;
				}
			}
		},
		callback
	);
}

function createBackupQueueViews (db, callback) {
	console.log('creating backup queue views');
	db.save(
		'_design/backup',
		{
			favorite_users : {
				map : getUserSpecificFunction(
					function (doc) {
						if (doc.type === 'tweet' && doc.favorite_count > 0 && doc.user.id_str === 'user_id_str' &&
							(!doc.entities || !doc.entities.favorite_users || doc.entities.favorite_users.length < doc.favorite_count)) {
							emit(doc.id_str, doc.favorite_count);
						}
					}
				)
			},
			media : {
				map : function (doc) {
					if (doc.type === 'tweet' && doc.entities && doc.entities.media) {
						doc.entities.media.forEach(function (media) {
							var hasAttachment = false;
							if (doc._attachments) {
								for (var attachment_id_str in doc._attachments) {
									if (attachment_id_str === media.id_str) {
										hasAttachment = true;
									}
								}
							}
							if (!hasAttachment) {
								emit(doc.id_str, {
									media_id_str : media.id_str,
									media_url : media.media_url
								});
							}
						});
					}
				}
			},
			retweets : {
				map : getUserSpecificFunction(
					function (doc) {
						if (doc.type === 'tweet' && doc.retweet_count > 0 && doc.user.id_str === 'user_id_str' &&
							(!doc.entities || !doc.entities.retweets || doc.entities.retweets.length < doc.retweet_count)) {
							emit(doc.id_str, doc.retweet_count);
						}
					}
				)
			},
			users : {
				map : function (doc) {
					if (doc.needsBackup && doc.type === 'user') {
						emit(doc.screen_name, doc);
					}
				}
			},
			tweets : {
				map : function (doc) {
					if (doc.needsBackup && doc.type === 'tweet') {
						emit(doc.id_str, doc);
					}
				}
			}
		},
		callback
	);
}

/**
 * Replace the user_id_str variable in a function with the user_id_str value from config.
 */
function getUserSpecificFunction (f) {
	if (config.user_id_str.match(/^\d*$/)) { // check user_id_str value to prevent injection attack
		eval('var userFunction = ' + f.toString().replace('user_id_str', config.user_id_str));
		return userFunction;
	}
	return f;	
}