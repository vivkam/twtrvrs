var action = process.argv.length > 2 ? process.argv[2] : null;

if (!action) {
	console.log('usage: node index.js [backup/server]');
} else if (action === 'db') { // temp for writing db init stuff
	module.exports = require('./lib/couchdb.js');
} else if (action === 'topsy') {
	module.exports = require('./lib/import-topsy.js');
} else if (action === 'backup') {
	module.exports = require('./lib/backup.js');	
} else if (action === 'server') {
	console.log('server not yet implemented');
} else {
	console.log('unrecognized action: ' + action)
}