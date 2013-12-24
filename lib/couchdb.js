/**
 * Connect to CouchDB. Initialize if necessary.
 * 
 * Events emitted:
 * - dbInitializing: database and view creation underway
 * - dbReady (db): database ready for use
 *
 * Model for _id property:
 * - tweets : "{tweet_id_str}"
 * - users  : "user:{user_id_str}"
 * - media  : "media:{media_id_str}"
 * - backup : "backup:{entity_id_str}"
 *
 * Backup documents have the following structure:
 * {
 *   _id    : "backup:{entity_id_str}",
 *   type   : "{tweet|retweet|user|media}",
 *   id_str : "{entity_id_str}",
 *   url    : "{url}" // optional, media only
 * }
 */
 
var _      = require('underscore'),
	util   = require('util'),
	events = require('events'),
	cradle = require('cradle'),
	config = require('./config.js'),
	couch,
	db;

function Couch () {
	events.EventEmitter.call(this);
}
util.inherits(Couch, events.EventEmitter);
couch = new Couch();

couch.dbReady = false;
couch.on('dbReady', function () {
	couch.dbReady = true;
});

couch.db = new(cradle.Connection)({
	host : config.couchdb.host,
	port : config.couchdb.port,
	cache : config.couchdb.cache
}).database(config.couchdb.database);

couch.createOrUpdateViews = createViews;

module.exports = couch;

db = couch.db;

db.exists(function (error, exists) {
	function exitWithError (error, message) {
		console.error(message);
		console.error(util.inspect(error));
		console.error('exiting');
		process.exit(1);		
	}
	if (error) {
		exitWithError('error checking database exists', error);
	} else if (!exists) {
		createDb(function (error, response) {
			if (error) {
				if (util.isArray(error)) {
					exitWithError('error creating views', error)
				} else {
					exitWithError('error creating database', error);	
				}
			} else {
				couch.emit('dbReady', db);
			}
		});
	} else {
		couch.emit('dbReady', db);
	}
});

/**
 * Creates database, then views.
 *
 * createDb(callback)
 *
 * callback(error, response)
 * - error: error object if database, error array if views, null if no errors
 * - response: array of view creation responses
 */
function createDb (callback) {
	console.log('creating database');
	couch.emit('dbInitializing');
	db.create(function (error, response) {
		if (error) {
			callback(error, response);
		}
		createViews(callback);
	});
}

/**
 * Creates views
 *
 * createViews(callback)
 *
 * callback(error, response)
 * - error: array of errors or null if no errors
 * - response: array of view creation responses
 */
function createViews (callback) {
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
			viewCreator(function (error, response) {
				if (error) {
					errors.push(error);	
				}
				if (response) {
					responses.push(response);	
				}
				createNextView();
			});
		} else {
			if (errors.length === 0) {
				errors = null;
			}
			callback(errors, responses);
		}
	}
	createNextView();
}

function createTweetViews (callback) {
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

function createUserViews (callback) {
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

function createDirectMessageViews (callback) {
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

function createBackupQueueViews (callback) {
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
 * Replace the user_id_str variable in a function with the user_id_str value from config,.
 */
function getUserSpecificFunction (f) {
	if (config.twitter.user_id_str.match(/^\d*$/)) {
		eval('var userFunction = ' + f.toString().replace('user_id_str', config.twitter.user_id_str));
		return userFunction;
	}
	return f;	
}