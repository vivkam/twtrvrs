/**
 * Import tweets from exported Twitter archive.
 * Date format inconsistent with Twitter API data. DO NOT USE.
 */

var fs        = require('fs'),
	util      = require('./util-uber.js'),
	twitUtil  = require('./util-twitter.js'),
	couch     = require('./couchdb.js'),	
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
	filenames.forEach(function (filename) {
		eval(fs.readFileSync(dir + filename, { encoding : 'utf8' }));
	});
}

function loadTweets () {
	for (var month in Grailbird.data) {
		var tweets = Grailbird.data[month];
		tweets.forEach(function (tweet) {
			var _id = tweet.id_str;
			util.removeEmptyProperties(tweet);
			tweet.user = twitUtil.getTrimmedUser(tweet.user);
			tweeting++;
			db.put(_id, tweet, function (error, response) {
				tweeting--;
				if (error && error.error === 'conflict') {
					oldTweet++;
				} else {
					newTweet++;
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