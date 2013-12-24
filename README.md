twtrvrs
=======

Back up your Twitterverse.

Main Features
-------------

- backup all your tweets, related tweets, and related entities
- database storage
- TODO: search API (or maybe just use CouchDB REST API)
- TODO: web UI

Detailed Backup Features
------------------------
- from Topsy API output JSON: by you, @ you, search of you (full tweet json)
- from Twitter export archive: by you (abbreviated tweet json)
- TODO: from Twitter streaming API
  - your tweets
  - your favorites
  - mentions of you
  - retweets of you
  - favorites of your tweets
  - users you've interacted with
  - attached media
  - direct messages sent & received
- backfill from Twitter rate-limited APIs
  - everything available streaming backup, except favorites of your tweets

Setup
-----

TODO: this section

Configuration
-------------

Edit config-default.json or override with config.json

Implementation
--------------

- Node.js
- CouchDB

Known Issues
------------

- Archiving favorites of your tweets is troublesome if you're not streaming them as they happen.
  - There's no way to query the Twitter API for all your tweets that have been favorited.
  - The Topsy API doesn't have favorite_count because they store the tweet they get from the firehose, which comes through when you post it, i.e. before anyone's had a chance to favorite it.
  - The Twitter export archive data does not contain favorite_count.
- Archiving retweets of your tweets from the Topsy or Twitter export archive is not possible because of the aforementioned issues with the Topsy firehose and the Twitter export archive content.