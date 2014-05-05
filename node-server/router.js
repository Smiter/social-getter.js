var config = require('./libs/config');
var helper = require('./libs/helper');
var log = require('./libs/log')(module);
var db = require('./libs/db');
var cronJob = require('cron').CronJob;
var youtube = require('youtube-feeds');
var graph = require('fbgraph');
var router = require('./router');

youtube.httpProtocol = config.youtube.httpProtocol
youtube.developerKey = config.youtube.developerKey

module.exports = function (app) {

    app.get('/api/:hubname/:social_name/:id', function(req, res, next){
        var options = {
            hubname: req.params.hubname,
            social_name: req.params.social_name,
            id: req.params.id,
            isManager:  req.query.manager,
            offset: req.query.offset,
            query: {
                "social_name": req.params.social_name
            },
            query_options: {
                "limit": 40   
            }
        }
        // helper.getHub(options, next, function(hub){
        //     options.hub = hub;
        //     db.connect(function(conn){
        //         if(options.social_name == 'facebook-events'){
        //             options.query_options["sort"] =  [["timestamp","asc"], ["pinned_time","asc"]];
        //         }else{
        //             options.query_options["sort"] = [['pinned_time','desc'], ['timestamp','desc']]
        //         }
        //         if(options.isManager != "true")
        //             options.query["accepted"] = 1;

        //         if (options.offset){
        //             options.query_options["skip"] = options.offset;
        //             helper.getNextFeed(options, next);
        //         }
        //         conn.collection(options.hubname).find(options.query, {}, options.query_options).toArray(function(err, posts){
        //             if(!err){
        //                 res.send({"posts": posts });
        //             }else{
        //                 next(new Error(error));
        //             }
        //         });
        //     });
        // });
        // var searchOptions = {
        //     q:     "atlanta"
        //   , type:  "post",
        //   fields: "id",
        //   limit: "200"
        // };

        // graph.search(searchOptions, function(err, res2) {
        //     res.send(res2);
        // });
        graph.get('/discoveratlanta/posts/?limit=80&fields=id,picture,object_id,message,created_time,from,link', function(err, res2) {
            console.log(err);
            var posts = Array();
            res2.data.forEach(function(element, index, array){
                        var post = {};
                        post["_id"] = element.id + "_" + options.social_name;
                        post["id"] = options.id;
                        post["social_name"] = options.social_name;
                        if(options.social_name == "facebook-posts"){
                            post["accepted"] = 0;
                        }
                        post["comment"] = "https://www.facebook.com/" + element.id.split("_")[0]+"/posts/"+ element.id.split("_")[1];
                        post["image"] = "https://graph.facebook.com/"+element.object_id+"/picture";
                        post["text"] = element.message;
                        post["timestamp"] = element.created_time;
                        post["author"] = element.from.name;
                        post["author_link"] = "http://facebook.com/"+element.from.id;
                        post["link"] = element.link;
                        post["avatar"] = "https://graph.facebook.com/"+element.from.id+"/picture";
                        posts.push(post);
                    });
            res.send(posts);
        });
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
}