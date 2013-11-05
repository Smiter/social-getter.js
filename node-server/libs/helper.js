var request = require('request');

module.exports.sendRequest = function (params, callback){
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

module.exports.social_media = ['twitter', 'facebook', 'instagram'];



