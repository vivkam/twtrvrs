/**
 * Connect to CouchDB. Initialize if necessary.
 * 
 * Events emitted:
 * - dbInitializing: database and view creation underway
 * - dbReady (db): database ready for use
 */
 
var config = require('config').couchdb,
	util   = require('util'),
	events = require('events'),
	cradle = require('cradle'),
	views  = require('./views.js'),
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
	host : config.host,
	port : config.port,
	cache : config.cache
}).database(config.database);

couch.createOrUpdateViews = views.createViews;

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
		views.createViews(db, callback);
	});
}
