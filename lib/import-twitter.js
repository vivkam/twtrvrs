/**
 * Import tweets from exported Twitter archive.
 * Less information than data from Twitter API.
 * Date format inconsistent with Twitter API data but both formats can be used to create JavaScript Date objects.
 */

var fs        = require('fs'),
	util      = require('./util-uber.js'),
	twitUtil  = require('./util-twitter.js'),
	couch     = require('./couchdb.js'),
	backup    = require('./backup.js'),
	dir       = require('./config.js').twitterExport.dir,
	filenames = fs.readdirSync(dir),
	Grailbird = { data : {} },
	oldTweet  = 0,
	newTweet  = 0,
	tweeting  = 0,
	db;

couch.on('dbReady', function () {
	db = couch.db;
	readFiles();
	loadTweets();
});

function readFiles () {
	console.log('reading files');
	filenames.forEach(function (filename) {
		eval(fs.readFileSync(dir + filename, { encoding : 'utf8' }));
	});
}

function loadTweets () {
	for (var month in Grailbird.data) {
		var tweets = Grailbird.data[month];
		tweets.forEach(function (tweet) {
			var _id = twitUtil.getTweetId(tweet);
			util.removeEmptyProperties(tweet);
			tweet.created_at = formatDate(tweet.created_at);
			tweet.user = twitUtil.getTrimmedUser(tweet.user);
			tweet.type = 'tweet';
			tweeting++;
			db.put(_id, tweet, function (error, response) {
				tweeting--;
				if (error && error.error === 'conflict') {
					oldTweet++;
				} else {
					newTweet++;
					backup.saveToBackupQueue(tweet.user, 'user');
					backup.backupRelatedEntities(tweet);
				}
				if (tweeting === 0) {
					console.log('existing tweets: ' + oldTweet);
					console.log('saved tweets: ' + newTweet);
					console.log('total tweets: ' + (oldTweet + newTweet));
				}
			});
		});
	}
}

/**
 * Format Twitter archive date format to Twitter API date format.
 *
 * input:  "2008-11-11 12:34:56 +0000"
 * output: "Tue Nov 11 12:34:56 +0000 2008"
 *
 * Time === 00:00:00 kinda blows. We can't definitively map this to a date.
 * Boo Twitter archive export.

 * input:  "2008-11-11 00:00:00 +0000"
 */
function formatDate (dateString) {
	var date = new Date(dateString);
	var utcString = date.toUTCString().split(',');
	var utcBits = utcString[1].trim().split(' ');
	return utcString[0] + ' ' + utcBits[1]  + ' ' + utcBits[0] + ' ' + utcBits[3]  + ' +0000 ' + utcBits[2];
}