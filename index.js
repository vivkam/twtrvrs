var util = require('util'),
	action = process.argv.length > 2 ? process.argv[2] : null,
	newDb = false,
	module;

if (!action) {
	console.log('usage: node index.js [dbviews|backup|server]');
} else if (action === 'dbviews') {
	module = require('./lib/couchdb.js');
	module.on('dbInitializing', function() {
		newDb = true;
	});
	module.on('dbReady', function() {
		if (!newDb) {
			module.createOrUpdateViews(function (error, response) {
				if (error) {
					console.error('error creating views');
					console.error(util.inspect(error));
				} else {
					console.log('view creation log: ');
					console.log(util.inspect(response));
				}
			});
		}
	});
} else if (action === 'backup') {
	module = require('./lib/backup.js');
	module.run();
} else if (action === 'stream') {
	module = require('./lib/backup.js');
	module.stream();
} else if (action === 'topsy') {
	require('./lib/import-topsy.js');
} else if (action === 'twitter') {
	require('./lib/import-twitter.js');
} else if (action === 'server') {
	console.log('server not yet implemented');
} else {
	console.log('unrecognized action: ' + action)
}