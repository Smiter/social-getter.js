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
    if(social_name && helper.social_media.indexOf(social_name) < 0){
        throw new Error(social_name + " social media is not supported");
    }
    db.connect(function(conn){
        var query = {}
        query["user"] = id;
        if(social_name)
            query["social_name"] = social_name;
        conn.collection("posts").findOne(query, function(err, first_post){
            callback(first_post===null);
        });
    });
}

function addPostsToDataBase(handler, options){
    db.connect(function(conn){
        if(options.write_next_url != false){
            var url = {}
            url['_id'] = options.id + options.social_name;
            url['social_name'] = options.social_name;
            url['next_url'] = options.next_url;
            url['offset'] = options.number_posts;
            conn.collection('nexturls').save(url, function(err, saved_url){
                if(err){
                    log.error(err);
                }
            });
        }
        
        conn.collection('posts').insert(options.posts, {continueOnError: true}, function(err, res){
                var query = {}
                query["user"] = options.id;
                query["social_name"] = options.social_name;
                if(!err){
                    conn.collection('posts').find(query).count(function(err, count){
                            if(count >= options.number_posts-10){
                                if(options.number_posts == 20){
                                    var options_query = {};
                                    options_query["limit"] = 20;
                                    conn.collection('posts').find(query, {}, options_query).toArray(function(err, posts){
                                        if(!err){
                                            if(options.callback && typeof options.callback === 'function')
                                                options.callback(posts);
                                        }else{
                                            log.error(err);
                                        }
                                    });
                                }
                            }else{
                                if ((options.next_url != undefined) && (options.next_url != null)){
                                    handler(options, options.callback);
                                }
                            }
                    });
                }else{
                    log.error("error during insert: " + err);
                }
        });
    });
}

function getTwitterFeed(options, callback){
    var twitter_params = {
        method: 'get',
        url: 'https://api.twitter.com/1.1/statuses/user_timeline.json',
        qs: {
            screen_name: options.id,
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
    if ((options.next_url != undefined) && (options.next_url != null)){
        twitter_params.qs.max_id = options.next_url;
        skip_tweet_with_max_id = true;
    }

    helper.sendRequest(twitter_params, function (err, response, body){
        var posts = Array();
        
        body.forEach(function(element, index, array){
            if (!skip_tweet_with_max_id || element.id_str != options.next_url){
                var post = {};
                post["user"] = options.id;
                post["social_name"] = "twitter";
                post["_id"] = element.id_str;
                post["timestamp"] = Math.round((new Date(element.created_at).getTime())/1000);
                post["text"] = element.text;
                //if we grab text posts then we should retrieve element.entities.urls - Array of urls inside the post
                post["author"] = element.user.name;
                post["author_link"] = "http://twitter.com/"+options.id
                post["author_nickname"] = element.user.screen_name
                post["avatar"] = element.user.profile_image_url;
                if(element.entities.urls && element.entities.urls.length > 0)
                    post["link"] = element.entities.urls[0].url;
                var media = element.entities.media;
                if(media != undefined && media != null && media.length > 0){
                    media.forEach(function(image_element, index, array){
                        post["image"] = image_element.media_url;
                        post["link"] = image_element.url;
                    })
                }
                if(!post["link"]){
                    post["link"] = "https://twitter.com/" + options.id + "/status/" + element.id_str;
                }
                posts.push(post);
            }
        });

        var max_id = body[body.length - 1].id_str;
        
        if(options.next_url == null || options.next_url != max_id){
            options["next_url"] = max_id;
            if(callback && typeof callback === 'function')
                options["callback"] = callback;
            options["posts"] = posts;
            options["social_name"] = "twitter";
            addPostsToDataBase(getTwitterFeed, options);
        }
    });

}

function parseFbBodyAndSave2Db(options, body, callback){
    var posts = Array();
    if ((body.paging != undefined) && (body.paging !== null))
        var next_url = body.paging.next;
    if(body.data){
        body.data.forEach(function(element, index, array){
            var post = {};
            if(element.picture != undefined && element.picture != null && element.message != null){
                post["user"] = options.id;
                post["social_name"] = "facebook";
                if(element.object_id)
                    post["image"] = "https://graph.facebook.com/"+element.object_id+"/picture";
                else
                    post["image"] = element.picture;
                post["_id"] = element.id;
                post["text"] = element.message;
                post["timestamp"] = element.created_time;
                post["author"] = element.from.name;
                post["author_link"] = "http://facebook.com/"+options.id;
                post["link"] = element.link;
                var urlRegex = /(https?:\/\/[^\s]+)/g;
                var url = element.message.match(urlRegex);
                if(url && url != "")
                    post["link"] = url;
                post["avatar"] = "https://graph.facebook.com/"+element.from.id+"/picture";
                posts.push(post);
            }
        });

        options["next_url"] = next_url;
        options["callback"] = callback;
        options["posts"] = posts;
        options["social_name"] = "facebook";
        addPostsToDataBase(getFacebookFeed, options);
    }
}

function getFacebookFeed(options, callback){
    if ((options.next_url != undefined) && (options.next_url != null)) {
        var fb_params = {
            method: 'get',
            url: options.next_url
        }
        helper.sendRequest(fb_params, function (err, response, body) {
            parseFbBodyAndSave2Db(options, body, callback);
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
                url: 'https://graph.facebook.com/' + options.id + '/posts',
                qs: {
                    access_token: fbAccessToken,
                    date_format: "U"
                }
            }
            helper.sendRequest(fb_params, function (err, response, body) {
                parseFbBodyAndSave2Db(options, body, callback);
            });
        });
    }
}

function parseInstBodyAndSave2Db(options, body, callback){
    var posts = [];
    if ((body.pagination != undefined) && (body.pagination !== null))
        var next_url = body.pagination.next_url;
    if(body.data){
        body.data.forEach(function(element, index, array){
            var post = {};
            post["user"] = options.id;
            post["social_name"] = "instagram";
            post["image"] = element.images.standard_resolution.url;
            if(element.caption)
                post["text"] = element.caption.text;
            post["_id"] = element.id;
            post["timestamp"] = parseInt(element.created_time);
            post["author"] = element.user.username;
            post["author_link"] = "http://instagram.com/"+options.id
            post["link"] = element.link;
            post["avatar"] = element.user.profile_picture;
            posts.push(post);
        });
        options["next_url"] = next_url;
        options["callback"] = callback;
        options["posts"] = posts;
        options["social_name"] = "instagram";
        addPostsToDataBase(getInstagramFeed, options);
    }else{
        log.warn(body)
    }
}

function getInstagramFeed(options, callback){
    if ((options.next_url != undefined) && (options.next_url != null)) {
        var instagram_next_url = {
            method: 'get',
            url: options.next_url
        };
        helper.sendRequest(instagram_next_url, function(err, response, body){
            parseInstBodyAndSave2Db(options, body, callback);
        });
    } else {
        var instagram_get_user_id_params = {
            method: 'get',
            url: 'https://api.instagram.com/v1/users/search',
            qs: {
                q: options.id, //username to search
                count: 1, //number of users to return
                access_token: config.instagram.oauth.access_token
            }
        };

        helper.sendRequest(instagram_get_user_id_params, function (err, response, body) {
            if(body.data){
                var user_id = body.data[0].id;

                var instagram_get_user_recent_params = {
                    method: 'get',
                    url: 'https://api.instagram.com/v1/users/' + user_id + '/media/recent',
                    qs: {
                        access_token: config.instagram.oauth.access_token
                    }
                };
                helper.sendRequest(instagram_get_user_recent_params, function(err, response, body){
                    parseInstBodyAndSave2Db(options, body, callback);
                });
            }else{
                log.error("Instagram access error" + body)
            }
        });
    }
}

new cronJob({
    cronTime: '0 * * * *', //every 15 minutes
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
                        var options = {
                            id: user,
                            next_url: null,
                            social_name: social_name,
                            write_next_url: false,
                            number_posts: Number.MAX_VALUE
                        };
                        switch(social_name){
                            case "twitter":
                                getTwitterFeed(options, function(posts){
                                    console.log("Twitter data was updated.");
                                });
                                break;

                            case "facebook":
                                getFacebookFeed(options, function(posts){
                                    console.log("Facebook data was updated.");
                                });
                                break;

                            case "instagram":
                                getInstagramFeed(options, function(posts){
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

//fetch posts when first visit ( collection is empty )
// we decided to pull first 40
function fetchPostsWhenCollectionEmpty(handler, id, social_name, callback){
    var options = {id: id, next_url:null, write_next_url: true, number_posts: 20}
    options["id"] = id;
    options["social_name"] = social_name;
    handler(options, function(posts){
        callback(posts);
        db.connect(function(conn){
            var query = {}
            query["_id"] = id+social_name;
            query["social_name"] = social_name;
            conn.collection("nexturls").findOne(query, function(err, post){
                if(post != null){
                    options["next_url"] = post.next_url;
                    options["number_posts"] = 40;
                    handler(options);
                }
            });
        });
    });
}

app.get('/api/:social_name/:id', function(req, res){
    var id = req.params.id;
    var social_name = req.params.social_name;
    isCollectionEmpty(social_name, id, function(isEmpty){
        if(isEmpty){
            switch(social_name){
                case "twitter":
                    fetchPostsWhenCollectionEmpty(getTwitterFeed, id, social_name, function(posts){
                        res.send(posts);
                    });
                    break;

                case "facebook":
                    fetchPostsWhenCollectionEmpty(getFacebookFeed, id, social_name, function(posts){
                        res.send(posts);
                    });
                    break;

                case "instagram":
                    fetchPostsWhenCollectionEmpty(getInstagramFeed, id, social_name, function(posts){
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
                    conn.collection('posts').find(query).count(function(err, count){
                        if(!err){
                            if(count <= parseInt(req.query.offset) + 40)
                                getNextFeed(id, social_name, req.query.offset, conn);
                        }else{
                            log.error(err);
                        }
                    });
                }
                conn.collection("posts").find(query, {}, options).toArray(function(err, items){
                    res.send(items);
                });
            });
        }
    });
});


function getNextFeed(id, social_name, offset, conn){
    var options = {
        id: id,
        write_next_url: true,
        number_posts: parseInt(offset)+40
    };
    var urls_query = {}
    urls_query["_id"] = id+social_name;
    conn.collection("nexturls").findOne(urls_query, function(err, url){
        if(url != null && url.offset < parseInt(offset) + 40){
            options.next_url = url.next_url;
            switch(social_name){
                case 'facebook':
                    getFacebookFeed(options);
                    break;
                case 'instagram':
                    getInstagramFeed(options);
                    break;
                case "twitter":
                    getTwitterFeed(options);
                break;
           }
       }
    });
}


app.get('/api/:id', function(req, res){
    var id = req.params.id;
    var social_name = req.params.social_name;
    isCollectionEmpty(null, id, function(isEmpty){
        if(isEmpty){

                var twitter_posts = null;
                var fb_posts = null;
                var instagram_posts = null;


                function checkIfPulledAndSend(){
                    if(fb_posts && instagram_posts && twitter_posts){
                        var posts = fb_posts.concat(instagram_posts, twitter_posts);
                        posts.sort(function(x, y){
                            return y.timestamp - x.timestamp;
                        })
                        res.send(posts.slice(0,20));
                    }
                }

                fetchPostsWhenCollectionEmpty(getTwitterFeed, id, "twitter", function(posts){
                    twitter_posts = posts;
                    checkIfPulledAndSend();
                });

                fetchPostsWhenCollectionEmpty(getInstagramFeed, id, "instagram", function(posts){
                    instagram_posts = posts;
                    checkIfPulledAndSend();
                });

                fetchPostsWhenCollectionEmpty(getFacebookFeed, id, "facebook", function(posts){
                    fb_posts = posts;
                    checkIfPulledAndSend();
                });
        }else{
            db.connect(function(conn){
                var query = {}
                query["user"] = id;
                var options = {};
                options["limit"] = 20;
                options["sort"] =  [["timestamp","desc"]];
                if (req.query.offset){
                    options["skip"] = req.query.offset;
                    getNextFeed(id, "facebook", req.query.offset, conn);
                    getNextFeed(id, "instagram", req.query.offset, conn);
                }
                conn.collection("posts").find(query, {}, options).toArray(function(err, items){
                    res.send(items);
                });
            });
        }
    });
})

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