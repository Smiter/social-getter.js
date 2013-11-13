var express = require('express');
var request = require('request');
var config = require('./libs/config');
var helper = require('./libs/helper');
var log = require('./libs/log')(module);
var app = express();
var db = require('./libs/db');
var cronJob = require('cron').CronJob;

var INTERNAL_ERROR = "Internal server error";

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

function isCollectionEmpty(social_name, hubname, callback){
    if(!callback || typeof callback !== 'function'){
        log.error("please provide callback");
        callback(INTERNAL_ERROR, null);
    }
    if(social_name && helper.social_media.indexOf(social_name) < 0){
        callback(social_name + " social media is not supported", null);
    }
    db.connect(function(conn){
        var query = {}
        if(social_name)
            query["social_name"] = social_name;
        conn.collection(hubname).findOne(query, function(err, first_post){
            callback(null, first_post===null);
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
        log.info("addPostsToDataBase: before insert to database: "+options.hubname + " social: " + options.social_name)
        conn.collection(options.hubname).insert(options.posts, {continueOnError: true}, function(err, res){
                var query = {}
                query["user"] = options.id;
                query["social_name"] = options.social_name;
                if(!err){
                    conn.collection(options.hubname).find(query).count(function(err, count){
                            if(count >= options.number_posts-10){
                                if(options.number_posts == 20){
                                    var options_query = {};
                                    options_query["limit"] = 20;
                                    conn.collection(options.hubname).find(query, {}, options_query).toArray(function(err, posts){
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
            conn.collection("hubs").find({}).toArray(function(err, hubs){
                if(hubs){
                    hubs.forEach(function(element, index, array){
                        if(element["facebook"]){
                            var options = {
                                id: element["facebook"],
                                next_url: null,
                                social_name: "facebook",
                                hubname: element["hubname"],
                                write_next_url: false,
                                number_posts: Number.MAX_VALUE
                            };
                            getFacebookFeed(options, function(posts){
                                console.log("Facebook data was updated.");
                            });
                        }

                        if(element["twitter"]){
                           var options = {
                                id: element["twitter"],
                                next_url: null,
                                social_name: "twitter",
                                hubname: element["hubname"],
                                write_next_url: false,
                                number_posts: Number.MAX_VALUE
                            };
                            getTwitterFeed(options, function(posts){
                                console.log("Twitter data was updated.");
                            });
                        }

                        if(element["instagram"]){
                           var options = {
                                id: element["instagram"],
                                next_url: null,
                                social_name: "instagram",
                                hubname: element["hubname"],
                                write_next_url: false,
                                number_posts: Number.MAX_VALUE
                            };
                            getInstagramFeed(options, function(posts){
                                console.log("Instagram data was updated.");
                            });
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
function fetchPostsWhenCollectionEmpty(handler, hubname, id, social_name, callback){
    var options = {id: id, next_url:null, write_next_url: true, number_posts: 20}
    options["id"] = id;
    options["social_name"] = social_name;
    options["hubname"] = hubname;
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

function getSocialIdHab(hubname, callback){
    db.connect(function(conn){
        var query = {};
        query["hubname"] = hubname;
        conn.collection('hubs').findOne(query, function(err, hub){
            if(!err){
                callback(null, hub);
            }
            else
                callback("getSocialIdHab: hubname - " + hubname + ", error - " + err, null);
        });
    });
}


app.get('/api/:hubname/:social_name', function(req, res, next){
    var hubname = req.params.hubname;
    var social_name = req.params.social_name;
    getSocialIdHab(hubname, function(err, hub){
        if(err){
            next(new Error(err));
            return;
        }
        if(!hub){
            next(new Error(hubname + " doesn't exist"));
            return;
        }
        if(hub && hub[social_name] != null && hub[social_name] != undefined)
            var id = hub[social_name];
        else{
            next(new Error(hubname + " HUB does not have " + social_name + " account"));
            return;
        }
            
        isCollectionEmpty(social_name, hub["hubname"], function(err, isEmpty){
            if(err){
                next(new Error(err));
                return;
            }
            if(isEmpty){
                switch(social_name){
                    case "twitter":
                        fetchPostsWhenCollectionEmpty(getTwitterFeed, hub["hubname"], id, social_name, function(posts){
                            res.send(posts);
                        });
                        break;

                    case "facebook":
                        fetchPostsWhenCollectionEmpty(getFacebookFeed, hub["hubname"], id, social_name, function(posts){
                            res.send(posts);
                        });
                        break;

                    case "instagram":
                        fetchPostsWhenCollectionEmpty(getInstagramFeed, hub["hubname"], id, social_name, function(posts){
                            res.send(posts);
                        });
                        break;
                }
            }else{
                db.connect(function(conn){
                    var query = {}
                    query["social_name"] = social_name;
                    var options = {};
                    options["limit"] = 20;
                    options["sort"] =  [["timestamp","desc"]];
                    if (req.query.offset){
                        options["skip"] = req.query.offset;
                        conn.collection(hub["hubname"]).find(query).count(function(err, count){
                            if(!err){
                                if(count <= parseInt(req.query.offset) + 40)
                                    getNextFeed(hub["hubname"], id, social_name, req.query.offset, conn);
                            }else{
                                log.error(err);
                            }
                        });
                    }
                    conn.collection(hub["hubname"]).find(query, {}, options).toArray(function(err, items){
                        res.send(items);
                    });
                });
            }
        });
    });
});


function getNextFeed(hubname, id, social_name, offset, conn){
    var options = {
        id: id,
        hubname: hubname,
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


app.get('/api/:hubname', function(req, res, next){
    var hubname = req.params.hubname;
    getSocialIdHab(hubname, function(err, hub){
        if(err){
            next(new Error(err));
            return;
        }
        if(!hub){
            next(new Error(hubname + " doesn't exist"));
            return;
        }

        var twitter_posts = null;
        var fb_posts = null;
        var instagram_posts = null;

        function removeDuplicates(posts){
            var newarr = [];
            var unique = {};
             
            posts.forEach(function(element, index, array) {
                if (!unique[element._id+element.social_name]) {
                    newarr.push(element);
                    unique[element._id+element.social_name] = element;
                }
            });
            return newarr;
        }
        function checkIfPulledAndSend(){
            if(hub["instagram"] == undefined){
                instagram_posts=true;
            }
            if(hub["facebook"] == undefined ){
                fb_posts=true;
            }
            if(hub["twitter"] == undefined){
                twitter_posts=true;
            }
            if( fb_posts && instagram_posts && twitter_posts ) {
                if(fb_posts && hub["facebook"] != undefined){
                    var posts = fb_posts;
                }
                if(instagram_posts && hub["instagram"] != undefined){
                    posts = posts.concat(instagram_posts);
                }
                if(twitter_posts && hub["twitter"] != undefined){
                    posts = posts.concat(twitter_posts);
                }
                posts = removeDuplicates(posts);
                posts.sort(function(x, y){
                    return y.timestamp - x.timestamp;
                })
                res.send(posts.slice(0,20));
            }
        }

        if(hub["twitter"] != undefined){
            isCollectionEmpty("twitter", hub["hubname"], function(err, isEmpty){
                if(err){
                    next(new Error(err));
                    return;
                }
                if(isEmpty){
                    fetchPostsWhenCollectionEmpty(getTwitterFeed, hub["hubname"], hub["twitter"], "twitter", function(posts){
                        twitter_posts = posts;
                        checkIfPulledAndSend();
                    });
                }else{
                    db.connect(function(conn){
                        var query = {}
                        query["social_name"] = "twitter";
                        var options = {};
                        options["limit"] = 20;
                        options["sort"] =  [["timestamp","desc"]];
                        if (req.query.offset){
                            var query = {}
                            options["skip"] = req.query.offset;
                            getNextFeed(hub["hubname"], hub["twitter"], "twitter", req.query.offset, conn);
                        }
                        conn.collection(hub["hubname"]).find(query, {}, options).toArray(function(err, posts){
                            twitter_posts = posts;
                            checkIfPulledAndSend();
                        });
                    });
                }
            });
        }

        if(hub["facebook"] != undefined){
            isCollectionEmpty("facebook", hub["hubname"], function(err, isEmpty){
                if(err){
                    next(new Error(err));
                    return;
                }
                if(isEmpty){
                    fetchPostsWhenCollectionEmpty(getFacebookFeed, hub["hubname"], hub["facebook"], "facebook", function(posts){
                        fb_posts = posts;
                        checkIfPulledAndSend();
                    });
                }else{
                    db.connect(function(conn){
                        var query = {}
                        query["social_name"] = "facebook";
                        var options = {};
                        options["limit"] = 20;
                        options["sort"] =  [["timestamp","desc"]];
                        if (req.query.offset){
                            var query = {}
                            options["skip"] = req.query.offset;
                            getNextFeed(hub["hubname"], hub["facebook"], "facebook", req.query.offset, conn);
                        }
                        conn.collection(hub["hubname"]).find(query, {}, options).toArray(function(err, posts){
                            fb_posts = posts;
                            checkIfPulledAndSend();
                        });
                    });
                }
            });
        }

        if(hub["instagram"] != undefined){
            isCollectionEmpty("instagram", hub["hubname"], function(err, isEmpty){
                if(err){
                    next(new Error(err));
                    return;
                }
                if(isEmpty){
                    fetchPostsWhenCollectionEmpty(getInstagramFeed, hub["hubname"], hub["instagram"], "instagram", function(posts){
                        instagram_posts = posts;
                        checkIfPulledAndSend();
                    });
                }else{
                    db.connect(function(conn){
                        var query = {}
                        query["social_name"] = "instagram";
                        var options = {};
                        options["limit"] = 20;
                        options["sort"] =  [["timestamp","desc"]];
                        if (req.query.offset){
                            var query = {}
                            options["skip"] = req.query.offset;
                            getNextFeed(hub["hubname"], hub["instagram"], "instagram", req.query.offset, conn);
                        }
                        conn.collection(hub["hubname"]).find(query, {}, options).toArray(function(err, posts){
                            instagram_posts = posts;
                            checkIfPulledAndSend();
                        });
                    });
                }
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