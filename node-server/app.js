var express = require('express');
var request = require('request');
var config = require('./libs/config');
var helper = require('./libs/helper');
var log = require('./libs/log')(module);
var app = express();
var db = require('./libs/db');
var cronJob = require('cron').CronJob;

app.configure(function() {
  app.use(express.cookieParser());
  app.use(express.multipart());
  app.use(express.methodOverride());
  app.use(express.logger('dev'));
  app.use(express.bodyParser());
  app.use(function(req, res, next) {
    res.header('Access-Control-Allow-Credentials', true);
    res.header('Access-Control-Allow-Origin', req.headers.origin);
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.header('Access-Control-Allow-Headers', 'X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept');
    next();
  });
});

function isCollectionEmpty(social_name, id, callback){
    if(!callback || typeof callback !== 'function')
        throw new Error("please provide callback");
    if(helper.social_media.indexOf(social_name) < 0){
        throw new Error(social_name + " social media is not supported");
    }
    db.connect(function(conn){
        var query = {}
        query["user"] = id;
        query["social_name"] = social_name;
        conn.collection("posts").findOne(query, function(err, first_post){
            callback(first_post===null);
        });
    });
}

function getTwitterFeed(id, max_tweet_id, cycle, callback){
    var twitter_params = {
        method: 'get',
        url: 'https://api.twitter.com/1.1/statuses/user_timeline.json',
        qs: {
            screen_name: id,
            count: 200,
            exclude_replies: 1,
            include_rts: 0
        },
        //oauth : {consumer_key: '',consumer_secret:'',token:'',token_secret:''}
        oauth: config.twitter.oauth
    }

    var skip_tweet_with_max_id = false;

    //if max_id was added to the query we will get one
    //tweet with this max_id so in order to avoid error on its
    //inserting into db we need to skip it
    if ((max_tweet_id != undefined) && (max_tweet_id != null)){
        twitter_params.qs.max_id = max_tweet_id;
        skip_tweet_with_max_id = true;
    }

    helper.sendRequest(twitter_params, function (err, response, body){
        var posts = Array();
        body.forEach(function(element, index, array){
            if (!skip_tweet_with_max_id || element.id_str != max_tweet_id){

                var media = element.entities.media;
                if(media != undefined && media != null && media.length > 0){
                    media.forEach(function(image_element, index, array){

                        var post = {};
                        post["user"] = id;
                        post["social_name"] = "twitter";
                        post["element_id"] = element.id_str;
                        post["_id"] = media.id_str;
                        post["image"] = image_element.media_url;
                        post["timestamp"] = new Date(element.created_at).getTime();
                        post["created_time"] =  helper.getPostedTime(new Date().getTime(), Math.round(new Date(element.created_at).getTime()/1000));
                        post["text"] = element.text;
                        //if we grab text posts then we should retrieve element.entities.urls - Array of urls inside the post
                        post["link"] = image_element.url;
                        post["author"] = element.user.name;
                        post["author_link"] = "http://twitter.com/"+id
                        post["author_nickname"] = element.user.screen_name
                        post["avatar"] = element.user.profile_image_url;
                        posts.push(post)
                    })
                }
            }
        });
        db.connect(function(conn){
            conn.collection('posts').insert(posts, function(err, res){
                if (err == null){
                    if(cycle && (body.length > 0)){
                        var max_id = body[body.length - 1].id_str;
                        getTwitterFeed(id, max_id, cycle, function(posts){
                           console.log('#');
                        });
                    }
                } else {
                    log.warn(err);
                }
            });
        });
        log.info("twitter posts have been sent");
        callback(posts);
    });

}

function parseFbBodyAndSave2Db(id, body, cycle, callback){
    var posts = Array();
    var next_url;
    if ((body.paging != undefined) && (body.paging !== null))
        next_url = body.paging.next;
    body.data.forEach(function(element, index, array){
        var post = {};
        if(element.picture != undefined && element.picture != null){
            post["user"] = id;
            post["social_name"] = "facebook";
            if(element.object_id)
                post["image"] = "https://graph.facebook.com/"+element.object_id+"/picture";
            else
                post["image"] = element.picture;
            post["_id"] = element.id;
            post["text"] = element.message;
            post["timestamp"] = element.created_time;
            post["created_time"] = helper.getPostedTime(new Date().getTime(), element.created_time);
            post["author"] = element.from.name;
            post["author_link"] = "http://facebook.com/"+id
            post["link"] = element.link;
            post["avatar"] = "https://graph.facebook.com/"+element.from.id+"/picture";
            posts.push(post);
        }
    });
    db.connect(function(conn){
        conn.collection('posts').insert(posts, function(err, res){
            if (err == null){
                if (cycle && (next_url != undefined) && (next_url != null)){
                    getFacebookFeed(id, next_url, cycle, function(posts){
                        console.log('#');
                    });
                }
            }
        });
    });
    log.info("fb posts have been sent");
    callback(posts);
}

function getFacebookFeed(id, url, cycle, callback){
    if ((url != undefined) && (url != null)) {
        var fb_params = {
            method: 'get',
            url: url
        }
        helper.sendRequest(fb_params, function (err, response, body) {
            parseFbBodyAndSave2Db(id, body, cycle, callback);
        });
    } else {
        var facebook_get_oauth_token_params = {
            method: 'get',
            url: 'https://graph.facebook.com/oauth/access_token',
            //oauth : {client_id: "", client_secret: "", grant_type: 'client_credentials'}
            qs: config.fb.oauth
        };

        helper.sendRequest(facebook_get_oauth_token_params, function (err, res2, body) {
            var fbAccessToken = body.replace('access_token=', '');
            var fb_params = {
                method: 'get',
                url: 'https://graph.facebook.com/' + id + '/posts',
                qs: {
                    access_token: fbAccessToken,
                    date_format: "U"
                }
            }
            helper.sendRequest(fb_params, function (err, response, body) {
                parseFbBodyAndSave2Db(id, body, cycle, callback);
            });
        });
    }
}

function parseInstBodyAndSave2Db(id, body, cycle, callback){
    var posts = [];
    var next_url;
    if ((body.pagination != undefined) && (body.pagination !== null))
        next_url = body.pagination.next_url;
    body.data.forEach(function(element, index, array){
        var post = {};
        post["user"] = id;
        post["social_name"] = "instagram";
        post["image"] = element.images.standard_resolution.url;
        if(element.caption)
            post["text"] = element.caption.text;
        post["_id"] = element.id;
        post["timestamp"] = element.created_time;
        post["created_time"] = helper.getPostedTime(new Date().getTime(), element.created_time);
        post["author"] = element.user.username;
        post["author_link"] = "http://instagram.com/"+id
        post["link"] = element.link;
        post["avatar"] = element.user.profile_picture;
        posts.push(post);
    });
    db.connect(function(conn){
        conn.collection('posts').insert(posts, function(err, res){
            if (err == null){
                if (cycle && (next_url != undefined) && (next_url != null)){
                    getInstagramFeed(id, next_url, cycle, function(posts){
                        console.log('#');
                    });
                }
            }
        });
    });
    log.info("instagram posts have been sent");
    callback(posts);
}

function getInstagramFeed(id, url, cycle, callback){
    if ((url != undefined) && (url != null)) {
        var instagram_next_url = {
            method: 'get',
            url: url
        };
        helper.sendRequest(instagram_next_url, function(err, response, body){
            parseInstBodyAndSave2Db(id, body, cycle, callback);
        });
    } else {
        var instagram_get_user_id_params = {
            method: 'get',
            url: 'https://api.instagram.com/v1/users/search',
            qs: {
                q: id, //username to search
                count: 1, //number of users to return
                access_token: config.instagram.oauth.access_token
            }
        };

        helper.sendRequest(instagram_get_user_id_params, function (err, response, body) {
            var user_id = body.data[0].id;

            var instagram_get_user_recent_params = {
                method: 'get',
                url: 'https://api.instagram.com/v1/users/' + user_id + '/media/recent',
                qs: {
                    access_token: config.instagram.oauth.access_token
                }
            };
            helper.sendRequest(instagram_get_user_recent_params, function(err, response, body){
                parseInstBodyAndSave2Db(id, body, cycle, callback);
            });
        });
    }
}

new cronJob({
    cronTime: '0,15,30,45 * * * *', //every 15 minutes
    onTick: function() {
        db.connect(function(conn){
            var grouping = {
                $group: {
                    _id: {
                        user: "$user",
                        social_name: "$social_name"
                    }
                }
            };
            conn.collection("posts").aggregate(grouping, function(err, res){
                if (res != null){
                    res.forEach(function(pair, index, array){
                        var user = pair._id.user;
                        var social_name = pair._id.social_name;
                        switch(social_name){
                            case "twitter":
                                getTwitterFeed(user, null, true, function(posts){
                                    console.log("Twitter data was updated.");
                                });
                                break;

                            case "facebook":
                                getFacebookFeed(user, null, true, function(posts){
                                    console.log("Facebook data was updated.");
                                });
                                break;

                            case "instagram":
                                getInstagramFeed(user, null, true, function(posts){
                                    console.log("Instagram data was updated.");
                                });
                                break;
                        }
                    });
                }
            });
        });
    },
    start: true
    //timeZone is not necessary
});

app.get('/api/:social_name/:id', function(req, res){
    var id = req.params.id;
    var social_name = req.params.social_name;
    isCollectionEmpty(social_name, id, function(isEmpty){
        if(isEmpty){
            switch(social_name){
                case "twitter":
                    getTwitterFeed(id, null, false, function(posts){
                        res.send(posts);
                    });
                    break;

                case "facebook":
                    getFacebookFeed(id, null, false, function(posts){
                        res.send(posts);
                    });
                    break;

                case "instagram":
                    getInstagramFeed(id, null, false, function(posts){
                        res.send(posts);
                    });
                    break;
            }
        }else{
            db.connect(function(conn){
                var query = {}
                query["user"] = id;
                query["social_name"] = social_name;
                var options = {};
                options["limit"] = 20;
                options["sort"] =  [["timestamp","desc"]];
                if (req.query.offset){
                    options["skip"] = req.query.offset;
                }
                conn.collection("posts").find(query, {}, options).toArray(function(err, items){
                    res.send(items);
                });
            });
        }
    });
    // //var user = 'discoveratlanta';
});

app.use(function(req, res, next){
    res.status(404);
    log.error('Not found URL: %s',req.url);
    res.send({ error: 'Not found' });
    return;
});

app.use(function(err, req, res, next){
    res.status(err.status || 500);
    log.error('Internal error(%d): %s',res.statusCode,err.message);
    res.send({ error: err.message });
    return;
});

app.listen(3000);