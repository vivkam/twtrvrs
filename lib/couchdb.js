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
	config = require('./config.js').couchdb,
	couch,
	db;

function Couch () {
	events.EventEmitter.call(this);
}
util.inherits(Couch, events.EventEmitter);
couch = new Couch();

couch.dbReady = false;
couch.on('dbReady', function() {
	couch.dbReady = true;
});

couch.db = new(cradle.Connection)({
	host : config.host,
	port : config.port,
	cache : config.cache
}).database(config.database);

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
		createDb(function(error, response) {
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
			createBackupQueueViews
		];
	function createNextView() {
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
	callback();
	// db.save(
	// 	'_design/tweets',
	// 	{
	// 		xxx : {
	// 		}
	// 	},
	// 	callback
	// );
}

function createUserViews (callback) {
	console.log('creating user views');
	db.save(
		'_design/users',
		{
			screenName : {
				map : function (doc) {
					if (doc._id.indexOf('user:') === 0) {
						emit(doc.screen_name, doc);
					}
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
			tweets : {
				map : function (doc) {
					if (doc.type === 'tweet' && doc._id.indexOf('backup:') === 0) {
						emit(doc.id_str, doc);
					}
				}
			},
			retweets : {
				map : function (doc) {
					if (doc.type === 'retweet' && doc._id.indexOf('backup:') === 0) {
						emit(doc.id_str, doc);
					}
				}
			},
			users : {
				map : function (doc) {
					if (doc.type === 'user' && doc._id.indexOf('backup:') === 0) {
						emit(doc.id_str, doc);
					}
				}
			},
			media : {
				map : function (doc) {
					if (doc.type === 'media' && doc._id.indexOf('backup:') === 0) {
						emit(doc.id_str, doc);
					}
				}
			}
		},
		callback
	);
}