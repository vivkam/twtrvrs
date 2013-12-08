/**
 * Import tweets from exported Twitter archive using Topsy API.
 */

var reader   = require('line-reader'),
	util     = require('./util-uber.js'),
	twitUtil = require('./util-twitter.js'),
	couch    = require('./couchdb.js'),
	backup   = require('./backup.js'),
	dir      = require('./config.js').topsyExport.dir,
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
	reader.eachLine(dir + type + '.json', function (line, last) {
		if (last) {
			stats.last = true;
		}
		loadTweet(JSON.parse(line), type, stats);
	});
}

/**
 * Load tweets.json output. File is JSON object array.
 */
function loadSearch () {
	var results = require(dir + 'search.json').response.results.list,
		stats = getStats();
	results.forEach(function (result) {
		loadTweet(result.tweet, 'search tweets', stats);
	});
	stats.last = true;
}

function loadTweet (tweet, type, stats) {
	var _id = tweet.id_str || '' + tweet.id;
	stats.loading++;
	if (!tweet.id_str) {
		tweet.id_str = _id;
	}
	delete tweet.topsy;
	tweet.user = twitUtil.getTrimmedUser(tweet);
	util.removeEmptyProperties(tweet);
	db.put(_id, tweet, function(error, response) {
		stats.loading--;
		if (error) {
			stats.errors++;
			console.error('error loading ' + type + ' ' + tweet.id_str + ': ' + error.error);
		} else {
			backup.backupRelatedEntities(tweet);
			stats.loaded++;
		}
		if (stats.last && stats.loading === 0) {
			console.log(stats.loaded + ' ' + type + ' loaded');
			console.log(stats.errors + ' ' + type + ' errored');
		}
	});
}

function getStats () {
	return {
		loading : 0,
		loaded  : 0,
		errors  : 0,
		last    : false
	};
}