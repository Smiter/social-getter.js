var express = require('express');
var request = require('request');
var config = require('./libs/config');
var helper = require('./libs/helper');
var log = require('./libs/log')(module);
var app = express();
var db = require('./libs/db');
var cronJob = require('cron').CronJob;
var youtube = require('youtube-feeds');
youtube.httpProtocol = 'https'
youtube.developerKey = 'AI39si4HROEvxCiaB3pFqQZmtORTR28jwpHHrJpfTlH_M2CZRBi-cyWOcrL572DW6swK0LiUdsV1MNWkxJ-2T2bmRF9aUOdSFg'

var INTERNAL_ERROR = "Internal server error";

app.configure(function() {
  app.use(express.cookieParser());
  app.use(express.multipart());
  app.use(express.methodOverride());
  app.use(express.logger('dev'));
  app.use(express.bodyParser());
  app.use(express.compress());

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
    log.info("addPostsToDataBase before");
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


        log.info("addPostsToDataBase: before insert to database: "+options.hubname + " social: " + options.social_name);
        log.info(options.next_url);
        conn.collection(options.hubname).insert(options.posts, {continueOnError: true}, function(err, res){
                var query = {}
                query["user"] = options.id;
                query["social_name"] = options.social_name;
                if(!err){
                    conn.collection(options.hubname).find(query).count(function(err, count){
                            log.info("INSIDE");
                            //log.info(count);
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
        if(body != null && body != undefined && typeof body != 'undefined' && body.length > 0 && body != ""){
            if(typeof body == "object"){
                //body = body["statuses"];
            }
            log.info("TWITTER")
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
                    //if(element.entities.urls && element.entities.urls.length > 0)
                        //post["link"] = element.entities.urls[0].url;
                    var media = element.entities.media;
                    if(media != undefined && media != null && media.length > 0){
                        media.forEach(function(image_element, index, array){
                            post["image"] = image_element.media_url;
                            //post["link"] = image_element.url;
                        })
                    }
                    //if(!post["link"]){
                    post["link"] = "https://twitter.com/" + options.id + "/status/" + element.id_str;
                    //}
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
        }
    });
}

function getTwitterPostsFeed(options, callback){
    var twitter_params = {
        method: 'get',
        url: 'https://api.twitter.com/1.1/search/tweets.json?',
        qs: {
            q: options["id"],
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
    log.info(twitter_params)
    helper.sendRequest(twitter_params, function (err, response, body){
        var posts = Array();
        if(body != null && body != undefined){
            log.info("BEFORE!!");
            //log.info(body)
            body = body["statuses"];
            
            body.forEach(function(element, index, array){
                if (!skip_tweet_with_max_id || element.id_str != options.next_url){
                    var post = {};
                    post["user"] = options.id;
                    post["social_name"] = "twitter-posts";
                    post["_id"] = element.id_str;
                    post["timestamp"] = Math.round((new Date(element.created_at).getTime())/1000);
                    post["text"] = element.text;
                    //if we grab text posts then we should retrieve element.entities.urls - Array of urls inside the post
                    post["author"] = element.user.name;
                    post["accepted"] = 0;
                    post["author_link"] = "http://twitter.com/"+options.id
                    post["author_nickname"] = element.user.screen_name
                    post["avatar"] = element.user.profile_image_url;
                    //if(element.entities.urls && element.entities.urls.length > 0)
                    //    post["link"] = element.entities.urls[0].url;
                    var media = element.entities.media;
                    if(media != undefined && media != null && media.length > 0){
                        media.forEach(function(image_element, index, array){
                            post["image"] = image_element.media_url;
                            //post["link"] = image_element.url;
                        })
                    }
                    //if(!post["link"]){
                    post["link"] = "https://twitter.com/" + options.id + "/status/" + element.id_str;
                    //}
                    var add = true;
                    var text_splitted = post["text"];
                    for(var i = 0; i < helper.keywords.length; i++){
                        if(text_splitted.search(new RegExp('.?'+helper.keywords[i]+'.?', "i"))>= 0){
                            add = false;
                            log.info("NOT ADDED");
                            break;
                        }
                    }
                    if(add)
                        posts.push(post);
                }
            });

            if(posts.length>0){
                var max_id = body[body.length - 1].id_str;
                
                if(options.next_url == null || options.next_url != max_id){
                    options["next_url"] = max_id;
                    if(callback && typeof callback === 'function')
                        options["callback"] = callback;
                    options["posts"] = posts;
                    options["social_name"] = "twitter-posts";
                    addPostsToDataBase(getTwitterPostsFeed, options);
                }
            }

            
        }
    });
}

function parseFbBodyAndSave2Db(options, body, callback){
    var posts = Array();
    log.info("BODY")
    //log.info(body)
    if ((body.paging != undefined) && (body.paging !== null))
        var next_url = body.paging.next;
    if(body.data){
        body.data.forEach(function(element, index, array){
            var post = {};
            if(element.picture != undefined && element.picture != null && element.message != null){
                post["user"] = options.id;
                //log.info("body post: " + options.social_name);
                post["social_name"] = options.social_name;
                if(options.social_name == "facebook-posts"){
                    post["accepted"] = 0;
                }
                log.info(options.id);
                post["comment"] = "https://www.facebook.com/" + element.id.split("_")[0]+"/posts/"+ element.id.split("_")[1];
                post["image"] = "https://graph.facebook.com/"+element.object_id+"/picture";
                
                post["_id"] = element.id+options.social_name;
                post["text"] = element.message;
                post["timestamp"] = element.created_time;
                post["author"] = element.from.name;
                post["author_link"] = "http://facebook.com/"+element.from.id;
                post["link"] = element.link;
                //log.info(post["link"])
                // var urlRegex = /(https?:\/\/[^\s]+)/g;
                // var url = element.message.match(urlRegex);
                // if(url && url != "" && options.social_name != "facebook-posts")
                //     post["link"] = url;
                post["avatar"] = "https://graph.facebook.com/"+element.from.id+"/picture";
                posts.push(post);
            }
        });
        
        var request_done = [];
        posts.forEach(function(element, index, array){
            request_done.push(0);
        });

        posts.forEach(function(element, index, array){
            helper.sendRequest(element['image']+"?redirect=false", function (err, res, body1) {
                if(body1.data){
                    element["image"] = body1.data.url;
                    request_done[index] = 1;
                    var all_done = true;
                    request_done.forEach(function(el, index2, array2){
                        if (el == 0){
                            all_done = false;
                        }
                    });
                    if (all_done == true){
                        options["next_url"] = next_url;
                        options["callback"] = callback;
                        options["posts"] = posts;
                        options["social_name"] = options.social_name;
                        addPostsToDataBase(getFacebookFeed, options);
                    }
                }else{
                    request_done[index] = 1;
                    var all_done = true;
                    request_done.forEach(function(el, index2, array2){
                        if (el == 0){
                            all_done = false;
                        }
                    });
                    if (all_done == true){
                        options["next_url"] = next_url;
                        options["callback"] = callback;
                        options["posts"] = posts;
                        options["social_name"] = options.social_name;
                        addPostsToDataBase(getFacebookFeed, options);
                    }
                }
            });
        });
    }
}

function parseFbEventsBodyAndSave2Db(options, body, callback){
    var posts = Array();
    if ((body.paging != undefined) && (body.paging !== null))
        var next_url = body.paging.next;
    if(body.data){
        body.data.forEach(function(element, index, array){
            var post = {};
            post["social_name"] = "facebook-events";
            post["user"] = options.id;
            post["name"] = element.name;
            post["image"] = "https://graph.facebook.com/"+element.id+"/picture?width=400";
            post["_id"] = element.id;
            post["start_time"] = element.start_time;
            post["end_time"] = element.end_time;
            post["location"] = element.location;
            post["author_link"] = "http://facebook.com/"+options.id;
            post["avatar"] = "https://graph.facebook.com/"+element.id+"/picture";
            post["accepted"] = 0;

            var event_query = {
                method: 'get',
                url: 'https://graph.facebook.com/'+ element.id +'?access_token=CAAJwSDBcEygBAK95FBt3bfHhPearUZCBwrrQePYV2cVyAfeaSlQiG6n7dqAP5eHUZBOiv9WNYY72McZCtEaHd9hF2b9pPWkZBGr3GiFgGk4efVw2EwbJAaPJIN9IxZBat0i4VzeB3w1sGG1waQoVfEU9DlmmdQdMcnmrjBp6AOKl1MoSFGxKuddNc23IfcbwZD',
            };

            helper.sendRequest(event_query, function (err, res2, body2) {
                if(body2.owner != undefined)
                    post["author"] = body2.owner.name;
                var txt = post["name"] + " ";
                if(body2.description != undefined){
                    txt += body2.description;
                    post["description"] = body2.description.split(" ").slice(0, 50).join(" ") + "...";
                }
                    
                // log.info(body2.description);
                var today = new Date();
                var event_date = new Date(element.start_time);

                if(today <= event_date){
                    post["timestamp"] = event_date.getTime();
                    var add = true;
                    var text_splitted = txt;
                    for(var i = 0; i < helper.keywords.length; i++){
                        if(text_splitted.search(new RegExp('.?'+helper.keywords[i]+'.?', "i"))>= 0){
                            add = false;
                            log.info("NOT ADDED");
                            break;
                        }
                    }
                    if(add)
                        posts.push(post);
                }

                if(index == array.length - 1){
                    var request_done = [];
                    posts.forEach(function(element, index, array){
                        request_done.push(0);
                    });

                    posts.forEach(function(element, index, array){
                        console.log(element['image']);
                        helper.sendRequest(element['image']+"?redirect=false", function (err, res, body1) {
                            if(body1.data){
                                element["image"] = body1.data.url;
                                request_done[index] = 1;
                                var all_done = true;
                                request_done.forEach(function(el, index2, array2){
                                    if (el == 0){
                                        all_done = false;
                                    }
                                });
                                if (all_done == true){
                                    options["next_url"] = next_url;
                                    options["callback"] = callback;
                                    options["posts"] = posts;
                                    options["social_name"] = "facebook-events";
                                    addPostsToDataBase(getFacebookFeed, options);
                                }
                            }else{
                                request_done[index] = 1;
                                var all_done = true;
                                request_done.forEach(function(el, index2, array2){
                                    if (el == 0){
                                        all_done = false;
                                    }
                                });
                                if (all_done == true){
                                    options["next_url"] = next_url;
                                    options["callback"] = callback;
                                    options["posts"] = posts;
                                    options["social_name"] = "facebook-events";
                                    addPostsToDataBase(getFacebookFeed, options);
                                }
                            }
                        });
                    });
                }
            });
            //log.info('https://graph.facebook.com/1471676389723004');
        });
    }
}

function parseFbGroupsBodyAndSave2Db(options, body, callback){
    var posts = Array();
    if ((body.paging != undefined) && (body.paging !== null))
        var next_url = body.paging.next;
    if(body.data){
        body.data.forEach(function(element, index, array){
            var post = {};
            post["user"] = options.id;
            post["_id"] = element.id;
            post["social_name"] = "facebook-groups";
            post["image"] = "https://graph.facebook.com/"+element.id+"/picture";
            post["author_link"] = "http://facebook.com/"+options.id;
            post["accepted"] = 0;

            var event_query = {
                method: 'get',
                url: 'https://graph.facebook.com/'+ element.id +'?access_token=CAAJwSDBcEygBAK95FBt3bfHhPearUZCBwrrQePYV2cVyAfeaSlQiG6n7dqAP5eHUZBOiv9WNYY72McZCtEaHd9hF2b9pPWkZBGr3GiFgGk4efVw2EwbJAaPJIN9IxZBat0i4VzeB3w1sGG1waQoVfEU9DlmmdQdMcnmrjBp6AOKl1MoSFGxKuddNc23IfcbwZD',
            };

            helper.sendRequest(event_query, function (err, res2, body2) {
                post["name"] = body2.name;
                post["privacy"] = body2.privacy;
                //log.info(element.id);
                if(body2.owner != undefined){
                    post["author"] = body2.owner.name;
                }
                var txt = post["name"];
                post["avatar"] = body2.icon;
                if(body2.description != undefined){
                    txt+=" " + body2.description;
                    post["description"] = body2.description.split(" ").slice(0, 50).join(" ") + "...";
                }
                    

                var add = true;
                var text_splitted = txt;
                for(var i = 0; i < helper.keywords.length; i++){
                    if(text_splitted.search(new RegExp('.?'+helper.keywords[i]+'.?', "i"))>= 0){
                        add = false;
                        log.info("NOT ADDED");
                        break;
                    }
                }
                if(add)
                    posts.push(post);

                if(index == array.length - 1){
                    var request_done = [];
                    posts.forEach(function(element, index, array){
                        request_done.push(0);
                    });

                    posts.forEach(function(element, index, array){
                        console.log(element['image']);
                        helper.sendRequest(element['image']+"?redirect=false", function (err, res, body1) {
                            if(body1.data){
                                element["image"] = body1.data.url;
                                request_done[index] = 1;
                                var all_done = true;
                                request_done.forEach(function(el, index2, array2){
                                    if (el == 0){
                                        all_done = false;
                                    }
                                });
                                if (all_done == true){
                                    options["next_url"] = next_url;
                                    options["callback"] = callback;
                                    options["posts"] = posts;
                                    options["social_name"] = "facebook-groups";
                                    addPostsToDataBase(getFacebookFeed, options);
                                }
                            }else{
                                request_done[index] = 1;
                                var all_done = true;
                                request_done.forEach(function(el, index2, array2){
                                    if (el == 0){
                                        all_done = false;
                                    }
                                });
                                if (all_done == true){
                                    options["next_url"] = next_url;
                                    options["callback"] = callback;
                                    options["posts"] = posts;
                                    options["social_name"] = "facebook-groups";
                                    addPostsToDataBase(getFacebookFeed, options);
                                }
                            }
                        });
                    });
                }
            });
            //log.info('https://graph.facebook.com/1471676389723004');
        });
    }
}

function getFacebookFeed(options, callback){
    if ((options.next_url != undefined) && (options.next_url != null)) {
        var fb_params = {
            method: 'get',
            url: options.next_url
        }
        helper.sendRequest(fb_params, function (err, response, body) {
            log.info("VASEA1");
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
                log.info("VASEA2");
                parseFbBodyAndSave2Db(options, body, callback);
            });
        });
    }
}

function getFacebookPostsFeed(options, callback){
    log.info("getFacebookPostsFeed")
    if ((options.next_url != undefined) && (options.next_url != null)) {
        var fb_params = {
            method: 'get',
            url: options.next_url,
            qs: {
                access_token: 'CAACEdEose0cBAKhSrSjjKTVSUaBTzTigjscAC7Xijph5s601hqT0JpSxdseE51erQ0prlvD7SM5OTatNBgYIcNgk4SICXd0u96DMN1818khpnTAScGLMDFsbeDi840SqF3DshOdNzKO9DsBKFHKv8mV2sgnu2DLQi8GxKMLkYoZBZAt73RRQ7UduGdJM7XWV7lPhhuDAZDZD',
            }
        }
        helper.sendRequest(fb_params, function (err, response, body) {
            parseFbBodyAndSave2Db(options, body, callback);
        });
    } else {
        log.info("getFacebookPostsFeed else");
        var fb_params = {
            method: 'get',
            url: 'https://graph.facebook.com/search?q='+options["id"]+'&type=post&date_format=U&access_token=CAACEdEose0cBAKhSrSjjKTVSUaBTzTigjscAC7Xijph5s601hqT0JpSxdseE51erQ0prlvD7SM5OTatNBgYIcNgk4SICXd0u96DMN1818khpnTAScGLMDFsbeDi840SqF3DshOdNzKO9DsBKFHKv8mV2sgnu2DLQi8GxKMLkYoZBZAt73RRQ7UduGdJM7XWV7lPhhuDAZDZD',
        };
        helper.sendRequest(fb_params, function (err, response, body) {
            log.info("SEND REQUEST CALLBACK");
            parseFbBodyAndSave2Db(options, body, callback);
        });
    }
}



function getFacebookEventsFeed(options, callback){
    if ((options.next_url != undefined) && (options.next_url != null)) {
        var fb_params = {
            method: 'get',
            url: options.next_url,
            qs: {
                access_token: 'CAAJwSDBcEygBAK95FBt3bfHhPearUZCBwrrQePYV2cVyAfeaSlQiG6n7dqAP5eHUZBOiv9WNYY72McZCtEaHd9hF2b9pPWkZBGr3GiFgGk4efVw2EwbJAaPJIN9IxZBat0i4VzeB3w1sGG1waQoVfEU9DlmmdQdMcnmrjBp6AOKl1MoSFGxKuddNc23IfcbwZD',
            }
        }
        helper.sendRequest(fb_params, function (err, response, body) {
            parseFbEventsBodyAndSave2Db(options, body, callback);
        });
    } else {
        var fb_params = {
            method: 'get',
            url: 'https://graph.facebook.com/search?q=' + options["id"] +'&type=event',
            qs: {
                access_token: 'CAAJwSDBcEygBAK95FBt3bfHhPearUZCBwrrQePYV2cVyAfeaSlQiG6n7dqAP5eHUZBOiv9WNYY72McZCtEaHd9hF2b9pPWkZBGr3GiFgGk4efVw2EwbJAaPJIN9IxZBat0i4VzeB3w1sGG1waQoVfEU9DlmmdQdMcnmrjBp6AOKl1MoSFGxKuddNc23IfcbwZD',
            }
        };
        helper.sendRequest(fb_params, function (err, response, body) {
            //log.info("GET BODY DATA");
            // log.info(body);
            //log.info(body.data.slice(0,1));
            parseFbEventsBodyAndSave2Db(options, body, callback);
        });
    }
}


function getFacebookGroupsFeed(options, callback){
    if ((options.next_url != undefined) && (options.next_url != null)) {
        var fb_params = {
            method: 'get',
            url: options.next_url,
            qs: {
                access_token: 'CAAJwSDBcEygBAK95FBt3bfHhPearUZCBwrrQePYV2cVyAfeaSlQiG6n7dqAP5eHUZBOiv9WNYY72McZCtEaHd9hF2b9pPWkZBGr3GiFgGk4efVw2EwbJAaPJIN9IxZBat0i4VzeB3w1sGG1waQoVfEU9DlmmdQdMcnmrjBp6AOKl1MoSFGxKuddNc23IfcbwZD',
            }
        }
        helper.sendRequest(fb_params, function (err, response, body) {
            parseFbGroupsBodyAndSave2Db(options, body, callback);
        });
    } else {
        var fb_params = {
            method: 'get',
            url: 'https://graph.facebook.com/search?q='+ options["id"] +'&type=group',
            qs: {
                access_token: 'CAAJwSDBcEygBAK95FBt3bfHhPearUZCBwrrQePYV2cVyAfeaSlQiG6n7dqAP5eHUZBOiv9WNYY72McZCtEaHd9hF2b9pPWkZBGr3GiFgGk4efVw2EwbJAaPJIN9IxZBat0i4VzeB3w1sGG1waQoVfEU9DlmmdQdMcnmrjBp6AOKl1MoSFGxKuddNc23IfcbwZD',
            }
        };
        helper.sendRequest(fb_params, function (err, response, body) {
            //log.info("GET BODY DATA");
            // log.info(body);
            //log.info(body.data.slice(0,1));
            parseFbGroupsBodyAndSave2Db(options, body, callback);
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
                if(body.data.length > 0){
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
                }
                
            }else{
                log.error("Instagram access error" + body)
            }
        });
    }
}

function getInstagramPostsFeed(options, callback){
    if ((options.next_url != undefined) && (options.next_url != null)) {
        var instagram_next_url = {
            method: 'get',
            url: options.next_url
        };
        helper.sendRequest(instagram_next_url, function(err, response, body){
            parseInstPostsBodyAndSave2Db(options, body, callback);
        });
    } else {
            var instagram_get_user_recent_params = {
                method: 'get',
                url: 'https://api.instagram.com/v1/tags/'+ options["id"] +'/media/recent',
                qs: {
                    access_token: config.instagram.oauth.access_token
                }
            };
            helper.sendRequest(instagram_get_user_recent_params, function(err, response, body){
                parseInstPostsBodyAndSave2Db(options, body, callback);
            });
    }
}

function parseInstPostsBodyAndSave2Db(options, body, callback){
    var posts = [];
    if ((body.pagination != undefined) && (body.pagination !== null))
        var next_url = body.pagination.next_url;
    if(body.data){
        body.data.forEach(function(element, index, array){
            var post = {};
            post["user"] = options.id;
            post["social_name"] = "instagram-posts";
            post["image"] = element.images.standard_resolution.url;
            post["accepted"] = 0;
            if(element.caption)
                post["text"] = element.caption.text;
            post["_id"] = element.id;
            post["timestamp"] = parseInt(element.created_time);
            post["author"] = element.user.username;
            post["author_link"] = "http://instagram.com/"+options.id
            post["link"] = element.link;
            post["avatar"] = element.user.profile_picture;
            var add = true;
            if( post["text"] != undefined){
                var text_splitted = post["text"];
                for(var i = 0; i < helper.keywords.length; i++){
                    if(text_splitted.search(new RegExp('.?'+helper.keywords[i]+'.?', "i"))>= 0){
                        log.info("KEYWROD = " + helper.keywords[i])
                        if(helper.keywords[i] != "RT ")
                            add = false;
                        log.info(text_splitted);
                        break;
                    }
                }
            }
            
            if(add)
                posts.push(post);
        });
        log.info("LENGTH = " + body.data.length)
        log.info("LENGTH2 = " + posts.length)
        log.info("next_url = " + next_url)
        options["next_url"] = next_url;
        options["callback"] = callback;
        options["posts"] = posts;
        options["social_name"] = "instagram-posts";
        addPostsToDataBase(getInstagramPostsFeed, options);
    }else{
        log.warn(body)
    }
}

function getYoutubeFeed(options, callback){
    if ((options.next_url != undefined) && (options.next_url != null)) {
        youtube.user( options["id"]).uploads( {
                'max-results':  20,
                'start-index': options.next_url,
                orderby:        'published'
            }, function(a, b){
                parseYoutubeBodyAndSave2Db(options, b, callback);
        });
    } else {
        youtube.user( options["id"]).uploads( {
                'max-results':  20,
                'start-index': 1,
                orderby:        'published'
            }, function(a, b){
                parseYoutubeBodyAndSave2Db(options, b, callback);
        });
    }
}

function getYoutubePostsFeed(options, callback){

    if ((options.next_url != undefined) && (options.next_url != null)) {
        log.info("NEXT URL = " + options.next_url)
        youtube.feeds.videos(
            {
                q:              options["id"],
                'max-results':  20,
                'start-index': options.next_url,
                orderby:        'relevance',
                relevance_lang_languageCode: 'US'
            },
            function(a, b){
                log.info("ADD TO DATABASE YOUTUBE POSTS");
                //log.info(posts);
                for(var i = 0;i < b.items.length;i++){
                    log.info(b.items[i]['id']);
                }
                parseYoutubePostsBodyAndSave2Db(options, b, callback);
            }
        )
    }else {
        log.info("getYoutubePostsFeed next url2");
        youtube.feeds.videos(
           {
               q:              options["id"],
               'max-results':  20,
               'start-index': 1,
               orderby:        'relevance',
               relevance_lang_languageCode: 'US'
           },
           function(a, b){
            log.info("ADD TO DATABASE YOUTUBE POSTS2");
            log.info(a);
            log.info("ADD TO DATABASE YOUTUBE POSTS3");
            log.info(b);
            //log.info(posts);
            for(var i = 0;i < b.items.length;i++){
                log.info(b.items[i]['id']);
            }
               parseYoutubePostsBodyAndSave2Db(options, b, callback);
           }
        )
    }
}

function parseYoutubeBodyAndSave2Db(options, body, callback){
    var posts = [];
    if ((body.startIndex != undefined) && (body.startIndex !== null))
        var next_url = parseInt(body.startIndex) + 20;
    if(body.items != undefined && body.items.length > 0){
        body.items.forEach(function(element, index, array){
            var post = {};
            post["user"] = element.uploader;
            post["social_name"] = "youtube";
            post["image"] = element.thumbnail.hqDefault;
            post["text"] = element.title;
            post["_id"] = element.id;
            post["author"] = element.uploader;
            post["link"] = element.player.default;
            posts.push(post);
        });
        options["next_url"] = next_url;
        options["callback"] = callback;
        options["social_name"] = "youtube";
        options["posts"] = posts;
        
        addPostsToDataBase(getYoutubeFeed, options);
    }else{
    }
}

function parseYoutubePostsBodyAndSave2Db(options, body, callback){
    var posts = [];
    if ((body.startIndex != undefined) && (body.startIndex !== null))
        var next_url = parseInt(body.startIndex) + 20;
    if(body.items.length > 0){
        body.items.forEach(function(element, index, array){
            var post = {};
            post["user"] = options.id;
            post["social_name"] = "youtube-posts";
            post["image"] = element.thumbnail.hqDefault;
            post["text"] = element.title;
            post["_id"] = element.id;
            post["author"] = element.uploader;
            post["accepted"] = 0;
            post["link"] = element.player.default;
            var add = true;
            var text_splitted = post["text"];
            for(var i = 0; i < helper.keywords.length; i++){
                if(text_splitted.search(new RegExp('.?'+helper.keywords[i]+'.?', "i"))>= 0){
                    add = false;
                    log.info("NOT ADDED");
                    break;
                }
            }
            if(add)
                posts.push(post);
        });
        options["next_url"] = next_url;
        options["callback"] = callback;
        options["social_name"] = "youtube-posts";
        options["posts"] = posts;
        
        addPostsToDataBase(getYoutubePostsFeed, options);
    }else{
    }
}

new cronJob({
    cronTime: '0 * * * *', //every 15 minutes
    // cronTime: '0,28,55 * * * *',
    onTick: function() {
        console.log("vasea");
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

                        if(element["instagram-posts"]){
                            for(i = 0; i < element["instagram-posts"].length; i++){
                                var id_social = element["instagram-posts"][i];
                                var options = {
                                     id: id_social,
                                     next_url: null,
                                     social_name: "instagram-posts",
                                     hubname: element["hubname"],
                                     write_next_url: false,
                                     number_posts: Number.MAX_VALUE
                                 };
                                 getInstagramPostsFeed(options, function(posts){
                                     console.log("Instagram data was updated.");
                                 });
                            }
                           
                        }

                         if(element["facebook-events"]){
                            for(i = 0; i < element["facebook-events"].length; i++){
                                var id_social = element["facebook-events"][i];
                               var options = {
                                   id: id_social,
                                   next_url: null,
                                   social_name: "facebook-events",
                                   hubname: element["hubname"],
                                   write_next_url: false,
                                   number_posts: Number.MAX_VALUE
                               };
                               conn.collection(element["hubname"]).remove({"social_name" : "facebook-events", "timestamp": {"$lte": new Date().getTime()}}, function(err, items){
                                   getFacebookEventsFeed(options, function(posts){
                                   });
                               });
                            }
                        }

                        if(element["twitter-posts"]){
                            for(i = 0; i < element["twitter-posts"].length; i++){
                                var id_social = element["twitter-posts"][i];
                               var options = {
                                   id: id_social,
                                   next_url: null,
                                   social_name: "twitter-posts",
                                   hubname: element["hubname"],
                                   write_next_url: false,
                                   number_posts: Number.MAX_VALUE
                               };
                                getTwitterPostsFeed(options, function(posts){
                                });
                            }
                        }

                        if(element["youtube"]){
                           var options = {
                               id: element["youtube"],
                               next_url: null,
                               social_name: "youtube",
                               hubname: element["hubname"],
                               write_next_url: false,
                               number_posts: Number.MAX_VALUE
                           };
                            getYoutubeFeed(options, function(posts){
                            });
                        }

                        if(element["youtube-posts"]){
                            for(i = 0; i < element["youtube-posts"].length; i++){
                                var id_social = element["youtube-posts"][i];
                                var options = {
                                   id: id_social,
                                   next_url: null,
                                   social_name: "youtube-posts",
                                   hubname: element["hubname"],
                                   write_next_url: false,
                                   number_posts: Number.MAX_VALUE
                                };
                                getYoutubePostsFeed(options, function(posts){
                                });
                            }
                        }

                    });
                }
            });
        });
    },
    start: false
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

app.get('/api/vasea', function(req, res, next){
    log.info("API VASEA")

            // var options = {
            //     id: "discoveratlanta",
            //     next_url: null,
            //     social_name: "facebook",
            //     hubname: "atlanta",
            //     write_next_url: false,
            //     number_posts: Number.MAX_VALUE
            // };
            // getFacebookFeed(options, function(posts){
            //     console.log("Facebook data was updated.");
            // });

            // var options = {
            //     id: "test",
            //     next_url: null,
            //     social_name: "facebook-events",
            //     hubname: "test",
            //     write_next_url: false,
            //     number_posts: Number.MAX_VALUE
            // };
            // db.connect(function(conn){
            //     conn.collection("test").remove({"social_name" : "facebook-events", "timestamp": {"$lte": new Date().getTime()}}, function(err, items){
            //         getFacebookEventsFeed(options, function(posts){
            //             console.log("Facebook data was updated.");
            //         });
            //     });
            // });

            // var options = {
            //     id: "t",
            //     next_url: null,
            //     social_name: "facebook-posts",
            //     hubname: "atlanta",
            //     write_next_url: false,
            //     number_posts: Number.MAX_VALUE
            // };
            // getFacebookPostsFeed(options, function(posts){
            //     console.log("Facebook data was updated.");
            // });

            // var options = {
            //     id: "test",
            //     next_url: null,
            //     social_name: "facebook-groups",
            //     hubname: "test",
            //     write_next_url: false,
            //     number_posts: Number.MAX_VALUE
            // };
            // getFacebookGroupsFeed(options, function(posts){
            //     console.log("Facebook data was updated.");
            // });

            //  var options = {
            //     id: "test",
            //     next_url: null,
            //     social_name: "twitter-posts",
            //     hubname: "test",
            //     write_next_url: false,
            //     number_posts: Number.MAX_VALUE
            // };
            // getTwitterPostsFeed(options, function(posts){
            //     console.log("Facebook data was updated.");
            // });
            // var options = {
            //     id: "test",
            //     next_url: null,
            //     social_name: "twitter",
            //     hubname: "test",
            //     write_next_url: false,
            //     number_posts: Number.MAX_VALUE
            // };
            // getTwitterFeed(options, function(posts){
            //     console.log("Facebook data was updated.");
            // });

           //  var options = {
           //      id: "atlanta",
           //      next_url: null,
           //      social_name: "youtube",
           //      hubname: "atlanta",
           //      write_next_url: false,
           //      number_posts: Number.MAX_VALUE
           //  };

           // getYoutubeFeed(options);

            // youtube.feeds.videos(
            //     {
            //         q:              'python',
            //         'max-results':  1,
            //         'start-index': 10,
            //         orderby:        'published'
            //     },
            //     function(a, b){
            //         res.send(b);
            //     }
            // )

            youtube.feeds.videos(
               {
                   q:              'atlanta',
                   'max-results':  50,
                   'start-index': 1,
               },
              // "UPqJ93ZX3Ok
               function(a, b){
                for(var i = 0;i < b.items.length;i++){
                    log.info(b.items[i]['id']);
                }
                   res.send(b)
               }
            )

});


app.get('/api/:hubname/hubs', function(req, res, next){
    getSocialIdHab(req.params.hubname, function(err, hub){
        res.send(hub);
    });
});

app.get('/api/:hubname/:social_name', function(req, res, next){
    if(req.connection.remoteAddress != "173.8.47.65")
         log.info(req.connection.remoteAddress);
    var hubname = req.params.hubname;
    var social_name = req.params.social_name;
    var isManager = req.query.manager;
    var keyword = req.query.keyword;
    getSocialIdHab(hubname, function(err, hub){
        if(err){
            next(new Error(err));
            return;
        }
        if(!hub){
            next(new Error(hubname + " doesn't exist"));
            return;
        }
        if(hub && hub[social_name] != null && hub[social_name] != undefined){
            var id = hub[social_name];
            log.info(id);
        }else{
            next(new Error(hubname + " HUB does not have " + social_name + " account"));
            return;
        }

        log.info(hub[social_name]);

        
            isCollectionEmpty(social_name, hub["hubname"], function(err, isEmpty){
                if(err){
                    next(new Error(err));
                    return;
                }
                if(isEmpty){
                    log.info("Collection empty");
                    var result={}
                    result["posts"] = [];
                    var data = {};
                    var i = 0;
                    for(i = 0; i < hub[social_name].length; i++){
                        id = hub[social_name][i];
                        switch(social_name){
                            case "twitter":
                                fetchPostsWhenCollectionEmpty(getTwitterFeed, hub["hubname"], id, social_name, function(posts){
                                    // data['posts'] = posts;
                                    result["posts"] = result["posts"].concat(posts);
                                    // res.send(data);
                                });
                                break;

                            case "facebook":
                                fetchPostsWhenCollectionEmpty(getFacebookFeed, hub["hubname"], id, social_name, function(posts){
                                    //data['posts'] = posts;
                                    //res.send(data);
                                    result["posts"] = result["posts"].concat(posts);
                                });
                                break;

                            case "instagram":
                                fetchPostsWhenCollectionEmpty(getInstagramFeed, hub["hubname"], id, social_name, function(posts){
                                    //data['posts'] = posts;
                                    //res.send(data);
                                    result["posts"] = result["posts"].concat(posts);

                                });
                                break;
                            case "instagram-posts":
                                fetchPostsWhenCollectionEmpty(getInstagramPostsFeed, hub["hubname"], id, social_name, function(posts){
                                    //data['posts'] = posts;
                                    //res.send(data);
                                    result["posts"] = result["posts"].concat(posts);

                                });
                                break;

                            case "facebook-events":
                                fetchPostsWhenCollectionEmpty(getFacebookEventsFeed, hub["hubname"], id, social_name, function(posts){
                                    //data['posts'] = posts;
                                    //res.send(data);
                                    result["posts"] = result["posts"].concat(posts);

                                });
                                break;
                            case "facebook-posts":
                                fetchPostsWhenCollectionEmpty(getFacebookPostsFeed, hub["hubname"], id, social_name, function(posts){
                                    //data['posts'] = posts;
                                    //res.send(data);
                                    result["posts"] = result["posts"].concat(posts);

                                });
                                break;

                            case "facebook-groups":
                                fetchPostsWhenCollectionEmpty(getFacebookGroupsFeed, hub["hubname"], id, social_name, function(posts){
                                    //data['posts'] = posts;
                                    //res.send(data);
                                    result["posts"] = result["posts"].concat(posts);

                                });
                                break;

                            case "twitter-posts":
                                fetchPostsWhenCollectionEmpty(getTwitterPostsFeed, hub["hubname"], id, social_name, function(posts){
                                    //data['posts'] = posts;
                                    //res.send(data);
                                    result["posts"] = result["posts"].concat(posts);

                                });
                                break;
                            log.info("VASE!!!!!!")    
                            console.log(hub["hubname"])
                            console.log(id)
                            console.log(social_name)
                            case "youtube":
                                fetchPostsWhenCollectionEmpty(getYoutubeFeed, hub["hubname"], id, social_name, function(posts){
                                    //data['posts'] = posts;
                                    //res.send(data);
                                    result["posts"] = result["posts"].concat(posts);

                                });
                                break;



                             case "youtube-posts":
                                fetchPostsWhenCollectionEmpty(getYoutubePostsFeed, hub["hubname"], id, social_name, function(posts){
                                    //data['posts'] = posts;
                                    //res.send(data);
                                    result["posts"] = result["posts"].concat(posts);

                                });
                                break;
                        }
                    }
                    var a = setInterval(function(){
                        if(result["posts"].length > 0 && hub[social_name].length == i){
                            clearInterval(a);
                            res.send(result);
                            log.info("SEND IF EMPTY");
                        }
                    }, 300);
                    
                }else{
                    log.info("SEND IF NOT EMPTY");

                    db.connect(function(conn){
                        var query = {}
                        query["social_name"] = social_name;
                        if(keyword != undefined)
                            query["user"] = keyword;
                        var options = {};
                        options["limit"] = 20;
                        if(social_name == 'facebook-events'){
                            options["sort"] =  [["timestamp","asc"], ["pinned_time","asc"]];
                        }else{
                            options["sort"] = [['pinned_time','desc'], ['timestamp','desc']]
                        }




                        if(social_name == 'instagram-posts' || social_name == 'youtube-posts' || social_name == 'twitter-posts' || social_name == 'facebook-posts' || social_name == 'facebook-events' || social_name == 'facebook-groups'){
                            
                            if(isManager!="true")
                                query["accepted"] = 1;
                        }

                        if (req.query.offset){
                            options["skip"] = req.query.offset;
                            conn.collection(hub["hubname"]).find(query).count(function(err, count){
                                if(!err){
                                    log.info("PARSE INT COUNT " + hub[social_name].length)
                                    log.info("COUNT " + count)
                                    if(count <= parseInt(req.query.offset) + 40){
                                        var i = 0;

                                        for(i = 0; i < hub[social_name].length; i++){
                                            id = hub[social_name][i];
                                            log.info("getNEXTFeed " + id)
                                            getNextFeed(hub["hubname"], id, social_name, req.query.offset, conn);
                                        }
                                    }
                                        
                                }else{
                                    log.error(err);
                                }
                            });
                        }
                        log.info(query);
                        conn.collection(hub["hubname"]).find(query, {}, options).toArray(function(err, posts){
                            var data = {};
                            data['posts'] = posts;
                            res.send(data);
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
        social_name: social_name,
        write_next_url: true,
        number_posts: parseInt(offset)+40
    };
    var urls_query = {}
    urls_query["_id"] = id+social_name;
    log.info(social_name)
    conn.collection("nexturls").findOne(urls_query, function(err, url){
        //log.info(url)
        if(url != null && url.offset < parseInt(offset) + 40){
            options.next_url = url.next_url;
            switch(social_name){
                case 'facebook':
                    getFacebookFeed(options);
                    break;
                case 'facebook-posts':
                    getFacebookPostsFeed(options);
                    break;
                case 'instagram':
                    getInstagramFeed(options);
                    break;
                case 'instagram-posts':
                    log.info("NEXTFEED INSTAGRA<")
                    getInstagramPostsFeed(options);
                    break;
                case "twitter":
                    getTwitterFeed(options);
                    break;
                case "twitter-posts":
                    getTwitterPostsFeed(options);
                    break;
                case "youtube":
                    getYoutubeFeed(options);
                    break;
                case "youtube-posts":
                    
                    getYoutubePostsFeed(options);
                    break;
           }
       }
       if(err){
        log.error("GetNextUrls Error - " + err)
       }
    });
}


app.get('/api/:hubname', function(req, res, next){
    if(req.connection.remoteAddress != "173.8.47.65")
         log.info(req.connection.remoteAddress);
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
            var not_avialable_social = Array();
            if(hub["instagram"] == undefined){
                instagram_posts=true;
                not_avialable_social.push("instagram");
            }
            if(hub["facebook"] == undefined ){
                fb_posts=true;
                not_avialable_social.push("facebok");
            }
            if(hub["twitter"] == undefined){
                twitter_posts=true;
                not_avialable_social.push("twitter");
            }
            if(hub["facebook-events"] == undefined){
                not_avialable_social.push("facebook-events");
            }
            if(hub["twitter-posts"] == undefined){
                not_avialable_social.push("twitter-posts");
            }
            if(hub["instagram-posts"] == undefined){
                not_avialable_social.push("instagram-posts");
            }
            if(hub["youtube-posts"] == undefined){
                not_avialable_social.push("youtube-posts");
            }
            if(hub["youtube"] == undefined){
                not_avialable_social.push("youtube");
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
                var data = {};
                var limit = 20;
                if (req.query.unlimit){
                    limit = 60;
                }
                data['posts'] = posts.slice(0, limit);
                data["not_avialable_social"] = not_avialable_social;
                res.send(data);
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