twtrvrs
=======

Back up your Twitterverse.

Main Features
-------------

* backup all your tweets, related tweets, and related entities
* database storage
* TODO: search API (or maybe just use CouchDB REST API)
* TODO: web UI

Detailed Backup Features
------------------------
* from Topsy API output JSON: by you, @ you, search of you (full tweet json)
* from Twitter export archive: by you (abbreviated tweet json)
* TODO: from Twitter streaming API
  * your tweets
  * your favorites
  * mentions of you
  * retweets of you
  * favorites of your tweets
  * users you've interacted with
  * attached media
  * direct messages sent & received
* backfill from Twitter rate-limited APIs
  * everything available streaming backup, except favorites of your tweets

Configuration
-------------

- edit config-default.json or override with config.json

Implementation
--------------

- Node.js
- CouchDB
