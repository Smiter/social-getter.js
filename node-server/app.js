var express = require('express');
var request = require('request');
var config = require('./libs/config');
var log = require('./libs/log')(module);
var app = express();
var router = require('./router');

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
router(app);

app.listen(3000);