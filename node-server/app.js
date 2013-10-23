var express = require('express');

var app = express();

app.get('/', function(req, res){
    res.end('response');
});

app.listen(3000);