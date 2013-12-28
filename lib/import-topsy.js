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
	var _id = twitUtil.getTweetId(tweet),
		user;
	if (!tweet.id_str) {
		tweet.id_str = '' + tweet.id;
	}
	delete tweet.topsy;
	if (type === 'mentions') {
		user = tweet.user;
		backup.saveOrUpdateUser(user);		
	}
	tweet.user = twitUtil.getTrimmedUser(tweet.user);
	tweet.type = 'tweet';
	util.removeEmptyProperties(tweet);
	db.save(_id, tweet, function (error, response) {
		if (error) {
			stats.errors++;
			console.error('error loading ' + type + ' ' + tweet.id_str + ': ' + error.error);
		} else {
			backup.backupRelatedEntities(tweet);
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