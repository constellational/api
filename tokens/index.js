var crypto = require('crypto');
var base64url = require('base64-url');
var Promise = require('bluebird');
var bcrypt = Promise.promisifyAll(require('bcryptjs'));
var AWS = require('aws-sdk');
var s3 = new AWS.S3();
Promise.promisifyAll(Object.getPrototypeOf(s3));

function getObj(bucket, key) {
  console.log("Going to get " + key + " from " + bucket);
  return s3.getObjectAsync({Bucket: bucket, Key: key}).then(function(data) {
    var s = new Buffer(data.Body).toString();
    return JSON.parse(s);
  });
}

function putJSON(bucket, key, obj) {
  console.log("Going to put " + key + " into " + bucket);
  return s3.putObjectAsync({Bucket: bucket, Key: key, Body: JSON.stringify(obj), ContentType: 'application/json'}); 
}

function randomString() {
  return base64url.escape(crypto.randomBytes(48).toString('base64'));
}

function checkToken(storedTokens, tempToken) {
  console.log("Going to check temporary token");
  return new Promise(function(resolve, reject) {
    if (!storedTokens || !storedTokens[tempToken.id]) reject('Authentication failed');
    else {
      var storedToken = storedTokens[tempToken.id];
      bcrypt.compareAsync(tempToken.secret, storedToken.hash).then(function(res) {
        var created = new Date(storedToken.created);
        var difference = Date.now() - created;
        if (!res || (difference > 900000)) reject('Authentication failed');
        else resolve();
      }).catch(function(err) {
        reject('Authentication failed');
      });
    }
  });
}

function generateToken(username, tempToken) {
  console.log("Going to generate token for " + username);
  var bucket = 'constellational-meta';
  var token = {
    id: randomString(),
    secret: randomString()
  };
  var user;
  console.log("Going to get user details");
  return getObj(bucket, username).then(function(u) {
    user = u;
    return checkToken(user.tempTokens, tempToken);
  }).then(function() {
    console.log("Going to bcrypt token");
    return bcrypt.hashAsync(token.secret, 10);
  }).then(function(hash) {
    console.log("Going to store bcrypted token");
    if (!user.tokens) user.tokens = {};
    user.tokens[token.id] = hash;
    return putJSON(bucket, username, user);
  }).then(function() {
    console.log("Going to return username and token");
    return {username: username, token: token};
  });
}

exports.handler = function(event, context) {
  console.log("Started");
  console.log(event);
  generateToken(event.username, event.token).then(context.succeed).catch(context.fail);
};
