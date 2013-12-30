/**
 * Import tweets from exported Twitter archive using Topsy API.
 */

var reader   = require('line-reader'),
	util     = require('../lib/util-uber.js'),
	twitUtil = require('../lib/util-twitter.js'),
	persist  = require('../backup/persist.js'),
	dir      = require('../lib/config.js').topsyExport.dir,
	couch    = require('../database/couchdb.js'),
	db;

couch.on('dbReady', function () {
	db = couch.db;
	loadLines('tweets');
	loadLines('mentions');
	loadSearch();
});

/**
 * Load bulktweets.json output. One line per JSON object.
 */
function loadLines (type) {
	var stats = getStats();
	console.log('loading ' + type);
	reader.eachLine(dir + type + '.json', function (line, last) {
		stats.tweetsRead++;
		loadTweet(JSON.parse(line), type, stats);
		if (last) {
			stats.readComplete = true;
		}
	});
}

/**
 * Load tweets.json output. File is JSON object array.
 */
function loadSearch () {
	var results = require(dir + 'search.json').response.results.list,
		stats = getStats();
	console.log('loading search');
	results.forEach(function (result) {
		stats.tweetsRead++;
		loadTweet(result.tweet, 'search tweets', stats);
	});
	stats.readComplete = true;
}

function loadTweet (tweet, type, stats) {
	if (!tweet.id_str) {
		tweet.id_str = '' + tweet.id;
	}
	delete tweet.topsy;
	persist.saveTweet(tweet, function (error, response) {
		if (error) {
			stats.errors++;
		} else {
			stats.loaded++;
		}
		stats.tweetsProcessed++;
		if (stats.readComplete && stats.tweetsRead === stats.tweetsProcessed) {
			console.log(stats.loaded + ' ' + type + ' loaded');
			console.log(stats.errors + ' ' + type + ' errored');
		}
	});
}

function getStats () {
	return {
		tweetsRead      : 0,
		tweetsProcessed : 0,
		loaded          : 0,
		errors          : 0,
		readComplete    : false
	};
}