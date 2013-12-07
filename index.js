var util = require('util'),
	action = process.argv.length > 2 ? process.argv[2] : null;

if (!action) {
	console.log('usage: node index.js [backup/server]');
} else if (action === 'dbviews') {
	require('./lib/couchdb.js').createOrUpdateViews(function (error, response) {
		if (error) {
			console.error('error creating views');
			console.error(util.inspect(error));
		} else {
			console.log('view creation log: ');
			console.log(util.inspect(response));
		}
	});

} else if (action === 'topsy') {
	require('./lib/import-topsy.js');
} else if (action === 'backup') {
	require('./lib/backup.js');	
} else if (action === 'server') {
	console.log('server not yet implemented');
} else {
	console.log('unrecognized action: ' + action)
}