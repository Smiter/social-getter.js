var express = require('express');
var request = require('request')
var config = require('./config')
var app = express();

function sendRequest(params, callback){
    var self = this
    var validCallback = callback && typeof callback === 'function'

    request(params, function (err, res, body) {
        if (err) {
            if (validCallback)
                return callback(err, null)
            throw err
        }

        var parsed = null
        // attempt to parse the string as JSON
        // if we fail, pass the callback the raw response body
        try {
            parsed = JSON.parse(body)
        } catch (e) {
            parsed = body
        } finally {
            if (validCallback)
                return callback(null, res, parsed)
        }
    })
}


app.get('/', function(req, res){

	var result = {images: {	twitter : null,	fb: null, instagram: null}};

    var twitter_params = {
		method: 'get',
		url: 'https://api.twitter.com/1.1/statuses/user_timeline.json',
	    qs: {
	    	screen_name: 'discoveratlanta',
	    	count: 200,
	    	exclude_replies: 1,
	    	include_rts: 0,
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
		var images = Array();
		body.forEach(function(element, index, array){
			var media = element.entities.media;
			if(media != undefined && media != null && media.length > 0){
				media.forEach(function(element, index, array){
					images.push(element.media_url)
				})
				
			}
		});
		result.images.twitter = images;
	});

	var fbAccessToken = null

	var facebook_get_oauth_token_params = {
		method: 'get',
		url: 'https://graph.facebook.com/oauth/access_token',
		//   oauth : {
	    //   client_id: "",
        //   client_secret: "",
        //   grant_type: 'client_credentials'
		// }
	    qs: config.fb.oauth
	}

    sendRequest(facebook_get_oauth_token_params, function (err, res2, body) {
        fbAccessToken = body.replace('access_token=', '');
        var user = 'discoveratlanta';
        var fb_params = {
        	method: 'get',
			url: 'https://graph.facebook.com/' + user + '/posts',
	    	qs: {
	    		access_token: fbAccessToken
			}
		}
		sendRequest(fb_params, function (err, response, body) {
				var images = Array();
	        	body.data.forEach(function(element, index, array){
	        		if(element.picture != undefined && element.picture != null){
	        			images.push(element.picture)
	        		}
	        	});
	        	result.images.fb = images;
			    res.write(JSON.stringify(result));
			    res.end();
	    })
    })  
	   
});

app.listen(3000);