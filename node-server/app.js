var express = require('express');
var unio = require('unio')

var client = unio()
var app = express();
var fbAccessToken = null


function getTwitterFeed(){
	
}
app.get('/', function(req, res){
var result = "<ul>";
	var params = {
	    q: 'pic.twitter.com',
	    count: 20,
	    oauth: {
	        consumer_key:       'nXKh2SnwAJelbx5qkNj2g',
	        consumer_secret:    'T0AlQBmw7cBZAvod0dTjBQ6ttrvF3nErXVzC5rlsU',
	        token:              '75014082-voQhmba9KOPEBiueTeD3n0k2z2zyNgBzuKcydgDWH',
	        token_secret:       '2nvivdQSna4ZUtR5Alcc2nUPjfOh41iKEh3LntpqOsd76',
	    }
	}
    
    
	client.use('twitter').get('search/tweets', params, function (err, response, body) {
		body.statuses.forEach(function(element, index, array){
			var media = element.entities.media;
			if(media != undefined && media != null && media.length > 0){
				media.forEach(function(element, index, array){
					result += '<li><img src="'+ element.media_url + '" /></li>';
				})
				
			}
		});
       // res.writeHead(200, {'Content-Type': 'text/html'});
       //res.write(result);
      //  res.end();
    });

    

    var oauthParams = {
            client_id: "210410175805402",
            client_secret: "1df32bf603f40f0d0a3839c5492772bf",
            grant_type: 'client_credentials'
        }

        client
            .use('fb')
            .get('oauth/access_token', oauthParams, function (err, res2, body) {
                fbAccessToken = body.replace('access_token=', '')
                console.log(fbAccessToken)
                var params = {
			    	q: 'newyork',
			    	access_token: fbAccessToken
				}
				client.use('fb').get('search', params, function (err, response, body) {
			        	body.data.forEach(function(element, index, array){
			        		if(element.picture != undefined && element.picture != null){
			        			//for getting bigger image, do not always works.
			        			//result += '<li><img src="'+ element.picture.substring(0, element.picture.lastIndexOf(".")-1)+"n.jpg" + '" /></li>';
			        			result += '<li><img src="'+ element.picture + '" /></li>';
			        		}
			        	});
			        	result += "</ul>"
			            res.writeHead(200, {'Content-Type': 'text/html'});
					    //res.write(JSON.stringify(body.data));
					    res.write(result);
					    res.end();
			    })
            })  
	   
});

app.listen(3000);