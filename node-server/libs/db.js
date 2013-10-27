var MongoClient = require('mongodb').MongoClient;
var log = require('./log')(module);

var db = null;
var url = 'mongodb://localhost:27017/socialdb';

module.exports.connect = function(callback){
  if(db){
    callback(db);
    return;
  }

  MongoClient.connect(url, function(err, conn) {
    if(err){
      log.error(err.message);
      throw new Error(err);
    } else {
      db = conn; 
      callback(db);
    }
  });
}

