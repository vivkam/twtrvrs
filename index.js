var util = require('util'),
	action = process.argv.length > 2 ? process.argv[2] : null,
	newDb = false,
	module;

if (!action) {
	console.log('usage: node index.js [dbviews|backup|server]');
} else if (action === 'dbviews') {
	module = require('./database/couchdb.js');
	module.on('dbInitializing', function() {
		newDb = true;
	});
	module.on('dbReady', function(db) {
		if (!newDb) {
			module.createOrUpdateViews(
				db,
				function (error, response) {
					if (error) {
						console.error('error creating views');
						console.error(util.inspect(error));
					} else {
						console.log('view creation log: ');
						console.log(util.inspect(response));
					}
				}
			);
		}
	});
} else if (action === 'backup') {
	module = require('./backup/backup.js');
	module.run();
} else if (action === 'stream') {
	module = require('./backup/backup.js');
	module.stream();
} else if (action === 'topsy') {
	require('./import/topsy.js');
} else if (action === 'twitter') {
	require('./import/twitter.js');
} else if (action === 'server') {
	console.log('server not yet implemented');
} else {
	console.log('unrecognized action: ' + action)
}