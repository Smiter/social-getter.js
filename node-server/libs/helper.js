var request = require('request');
var db = require('../libs/db');
var facebook = require('./facebook')

module.exports = {

    sendRequest: function (params, callback){
        var self = this;
        var validCallback = callback && typeof callback === 'function';

        request(params, function (err, res, body) {
            if (err) {
                if (validCallback)
                    return callback(err, null)
                throw err
            }

            var parsed = null;
            // attempt to parse the string as JSON
            // if we fail, pass the callback the raw response body
            try {
                parsed = JSON.parse(body)
            } catch (e) {
                parsed = body
            } finally {
                if (validCallback)
                    return callback(null, res, parsed);
            }
        })
    },

    getHub: function(options, next, callback){
        db.connect(function(conn){
            var query = {
                "hubname": options.hubname
            };
            conn.collection('hubs').findOne(query, function(err, hub){
                if(err){
                    next(new Error("getSocialIdHab: hubname - " + options.hubname + ", error - " + err));
                    return;
                }
                if(!hub){
                    next(new Error(options.hubname + " doesn't exist"));
                    return;
                }
                if(!hub[options.social_name]){
                    next(new Error(options.hubname + " HUB does not have " + options.social_name + " account"));
                    return;
                }
                callback(hub);
            });
        });
    },
    getNextFeed: function(options, next){
        db.connect(function(conn){
            conn.collection(options.hubname).find(options.query).count(function(err, count){
                if(!err){
                    if(count <= parseInt(options.offset) + 40){
                        if(options.id == 'all'){
                            for(var i = 0; i < options.hub[options.social_name].length; i++){
                                options.id = hub[social_name][i];
                                pullNextFeed(options, next);
                            }
                        }else{
                            pullNextFeed(options, next);
                        }
                    }
                }else{
                    next(new Error(error));
                }
            });
        });
    },
    pullNextFeed: function(options, next){
        options.write_next_url = true;
        options.number_posts = parseInt(options.offset) + 40;
        var urls_query = {
            "hubname": options.hubname,
            "social_name": options.social_name,
            "id": options.id
        }
        conn.collection("nexturls").findOne(urls_query, function(err, url){
            if(!err){
                options.next_url = url.next_url;
                switch(options.social_name){
                    case 'facebook':
                        facebook.getUserFeed(options, next, addPostsToDataBase);
                        break;
                    // case 'facebook-posts':
                    //     getFacebookPostsFeed(options);
                    //     break;
                    // case 'instagram':
                    //      getInstagramFeed(options);
                    //      break;
                    // case 'instagram-posts':
                    //      getInstagramPostsFeed(options);
                    //      break;
                    // case "twitter":
                    //      getTwitterFeed(options);
                    //      break;
                    // case "twitter-posts":
                    //      getTwitterPostsFeed(options);
                    //      break;
                    // case "youtube":
                    //      getYoutubeFeed(options);
                    //      break;
                    // case "youtube-posts":
                    //      getYoutubePostsFeed(options);
                    //      break;
                }
            }else{
                next(new Error(err));
            }
        });
    },

    saveNextUrl: function(options){
        db.connect(function(conn){
            var url = {
                "hubname": options.hubname,
                "social_name": options.social_name,
                "id": options.id,
                "next_url": options.next_url
            }
            conn.collection('nexturls').save(url, function(err, saved_url){
                if(err){
                    next(new Error(err));
                }
            });
        });
    },

    addPostsToDataBase: function(options, posts, next){
        saveNextUrl(options, next);
        db.connect(function(conn){
            conn.collection(options.hubname).insert(posts, {continueOnError: true}, function(err, res){
            });
        });
    }
}