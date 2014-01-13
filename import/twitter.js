/**
 * Import tweets from exported Twitter archive.
 * Less information than data from Twitter API.
 * Date format inconsistent with Twitter API data but both formats can be used to create JavaScript Date objects.
 */

var fs        = require('fs'),
	util      = require('uber-util'),
	twitUtil  = require('../lib/util-twitter.js'),
	backup    = require('../backup/backup.js'),
	persist   = require('../backup/persist.js'),
	dir       = require('../lib/config.js').twitterExport.dir,
	couch     = require('../database/couchdb.js'),
	filenames = fs.readdirSync(dir),
	Grailbird = { data : {} },
	tweets    = [],
	oldTweets = 0,
	newTweets = 0,
	errors    = 0,
	db;

process.on('exit', function () {
	console.log('existing tweets: ' + oldTweets);
	console.log('saved tweets: ' + newTweets);
	console.log('total tweets: ' + (oldTweets + newTweets));
});

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
	console.log(filenames.length + ' files read');
	for (var month in Grailbird.data) {
		var monthTweets = Grailbird.data[month];
		tweets = tweets.concat(monthTweets);
	}
	console.log(tweets.length + ' tweets read');
}

function loadTweets () {
	console.log('loading tweets');
	tweets.forEach(loadTweet);
}

function loadTweet (tweet) {
	tweet.created_at = formatDate(tweet.created_at);
	persist.saveTweet(tweet, function (error, response) {
		if (error && error.error === 'conflict') {
			oldTweets++;
		} else if (error) {
			errors++;
		} else {
			newTweets++;
		}
	});
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