var graph = require('fbgraph');

function Facebook(){
    graph.setAccessToken('CAAJwSDBcEygBAK95FBt3bfHhPearUZCBwrrQePYV2cVyAfeaSlQiG6n7dqAP5eHUZBOiv9WNYY72McZCtEaHd9hF2b9pPWkZBGr3GiFgGk4efVw2EwbJAaPJIN9IxZBat0i4VzeB3w1sGG1waQoVfEU9DlmmdQdMcnmrjBp6AOKl1MoSFGxKuddNc23IfcbwZD');
}

Facebook.prototype.parsebody = function(options, res, next){
    var posts = Array();
    if(res.paging){
        options.next_url = res.paging.next;
    }
    if(res.data){
        res.data.forEach(function(element, index, array){
            var post = {};
            post["_id"] = element.id + "_" + options.social_name;
            post["id"] = options.id;
            post["social_name"] = options.social_name;
            if(options.social_name == "facebook-posts"){
                post["accepted"] = 0;
            }
            post["comment"] = "https://www.facebook.com/" + element.id.split("_")[0]+"/posts/"+ element.id.split("_")[1];
            if(element.object_id)
                post["image"] = "https://graph.facebook.com/"+element.object_id+"/picture";
            post["text"] = element.message;
            post["timestamp"] = element.created_time;
            post["author"] = element.from.name;
            post["author_link"] = "http://facebook.com/"+element.from.id;
            post["link"] = element.link;
            post["avatar"] = "https://graph.facebook.com/"+element.from.id+"/picture";
            posts.push(post);
        });
        return posts;
    }else{
        next(new Error("data is empty"))
    }
}

Facebook.prototype.getUserFeed = function(options, next, callback){
    var url = '/'+options.id + '/posts/?limit=80&fields=id,picture,object_id,message,created_time,from,link';
    if (options.next_url){
        url = options.next_url;
    }

    graph.get(url, function(err, res) {
        if(!err){
            var posts = parsebody(options, res, next);
            callback(options, posts, next);
        }else{
            next(new Error(err));
        }
    });
}

module.exports = new Facebook();