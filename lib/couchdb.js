/**
 * Connect to CouchDB. Initialize if necessary.
 */
 
var util   = require('util'),
	events = require('events'),
	cradle = require('cradle'),
	config = require('./config.js').couchdb,
	couch,
	db,
	initCount = 0;

function Couch () {
	events.EventEmitter.call(this);
}
util.inherits(Couch, events.EventEmitter);
couch = new Couch();
module.exports = couch;

db = couch.db = new(cradle.Connection)({
	host : config.host,
	port : config.port,
	cache : config.cache
}).database(config.database);

db.exists(function (error, exists) {
	if (error) {
		console.error('error checking database exists: ' + error);
		process.exit(1);
	} else if (!exists) {
		console.log('initializing database');
		createDb();
		createViews();
	} else {
		couch.emit('dbReady', db);
	}
});

function createDb () {
	initCount++;
	db.create(function (error, response) {
		if (error) {
			console.error('error creating database: ' + error);
			process.exit(1);
		}
		initCount--;
		if (initCount === 0) {
			couch.emit('dbReady', db);
		}
	});
}

function createViews () {
	console.log('creating views');
	createTweetViews();
	createUserViews();
}

function createTweetViews () {
	initCount++;
	db.save(
		'_design/tweets',
		{
			id : { // we don't actually need this do we?
				map : function (doc) {
					if (doc.created_at && doc.text) {
						emit(doc._id, null);
					}
				}
			}
		}, function (error, response) {
			if (error) {
				console.error('error creating view tweets/id: ' + error);
				process.exit(1);
			}
			initCount--;
			if (initCount === 0) {
				couch.emit('dbReady', db);
			}
		}
	);
}

function createUserViews () {
	initCount += 0;
}