var express = require('express');
var request = require('request');
var config = require('./config');
var helper = require('./helper');
var app = express();


function sendRequest(params, callback){
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
}


app.get('/', function(req, res){

    var result = {posts: {	twitter : null,	fb: null, instagram: null}};
    var user = 'discoveratlanta';
    var twitter_params = {
        method: 'get',
        url: 'https://api.twitter.com/1.1/statuses/user_timeline.json',
        qs: {
            screen_name: user,
            count: 200,
            exclude_replies: 1,
            include_rts: 0
        },
        //oauth : {
        //consumer_key:       '',
        //consumer_secret:    '',
        //token:              '',
        //token_secret:       '',
        //}
        oauth: config.twitter.oauth
    }

    sendRequest(twitter_params, function (err, response, body){
        var posts = Array();
        body.forEach(function(element, index, array){
            var post = {};
            var media = element.entities.media;

            if(media != undefined && media != null && media.length > 0){
                media.forEach(function(image_element, index, array){
                    post["image"] = image_element.media_url;
					post["created_time"] =  helper.getPostedTime(new Date().getTime(), Math.round(new Date(element.created_at).getTime()/1000)); 
					post["text"] = element.text;
					post["author"] = element.user.name
					post["author_nickname"] = element.user.screen_name
					post["avatar"] = element.user.profile_image_url;
					posts.push(post)
                })
            }

        });

        result.posts.twitter = posts;
    });

    var fbAccessToken = null;

    var facebook_get_oauth_token_params = {
        method: 'get',
        url: 'https://graph.facebook.com/oauth/access_token',
        //   oauth : {
        //   client_id: "",
        //   client_secret: "",
        //   grant_type: 'client_credentials'
        // }
        qs: config.fb.oauth
    };


    sendRequest(facebook_get_oauth_token_params, function (err, res2, body) {
        fbAccessToken = body.replace('access_token=', '');
        var user = 'discoveratlanta';
        var fb_params = {
            method: 'get',
            url: 'https://graph.facebook.com/' + user + '/posts',
            qs: {
                access_token: fbAccessToken,
                date_format: "U"
            }
        }
        sendRequest(fb_params, function (err, response, body) {
            var posts = Array();
            body.data.forEach(function(element, index, array){
                var post = {};
                if(element.picture != undefined && element.picture != null){
                    post["image"] = "https://graph.facebook.com/"+element.object_id+"/picture";
        			post["text"] = element.message;
        			post["created_time"] = helper.getPostedTime(new Date().getTime(), element.created_time);
        			post["author"] = element.from.name;
        			post["avatar"] = "https://graph.facebook.com/"+element.from.id+"/picture";
        			posts.push(post)
                }
            });
            result.posts.fb = posts;
            result.posts.instagram = posts;
            res.write(JSON.stringify(result));
            res.end();
        });
    });

    var instagram_get_user_id_params = {
        method: 'get',
        url: 'https://api.instagram.com/v1/users/search',
        qs: {
            q: user, //username to search
            count: 1, //number of users to return
            access_token: config.instagram.oauth.access_token
        }
    };

    sendRequest(instagram_get_user_id_params, function (err, response, body) {
        var user_id = body.data[0].id;

        var instagram_get_user_recent_params = {
            method: 'get',
            url: 'https://api.instagram.com/v1/users/' + user_id + '/media/recent',
            qs: {
                access_token: config.instagram.oauth.access_token
            }
        };
        sendRequest(instagram_get_user_recent_params, function(err, response, body){
            var posts = [];
            body.data.forEach(function(element, index, array){
                var post = {};
                post["image"] = element.images.standard_resolution.url;
                post["text"] = element.caption.text;
                post["created_time"] = helper.getPostedTime(new Date().getTime(), element.created_time);
                post["user"] = element.user.username;
                post["profile_picture"] = element.user.profile_picture;
                posts.push(post);
            });
            result.posts.instagram = posts;
        });
    });
});

app.listen(3000);