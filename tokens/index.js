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

function checkToken(username, tempToken) {
  console.log("Going to check temporary token for " + username);
  var bucket = 'constellational-meta';
  var storedToken = {};
  return new Promise(function(resolve, reject) {
    return getObj(bucket, username).then(function(obj) {
      storedToken = obj.tempTokens[tempToken.id];
      return bcrypt.compareAsync(tempToken.secret, storedToken.hash);
    }).then(function(res) {
      if (!res) reject('Authentication failed');
      else {
        var created = new Date(storedToken.created);
        var difference = Date.now() - created;
        if (difference > 900000) resolve();
        else reject('Authentication failed');
      }
    }).catch(function(err) {
      reject('Authentication failed');
    });
  });
}

function generateToken(username, tempToken) {
  console.log("Going to generate token for " + username);
  var bucket = 'constellational-meta';
  var token = {
    id: randomString(),
    secret: randomString()
  };
  var user = {tokens: [], email: email};
  return checkToken(username, tempToken).then(function() {
    console.log("Going to bcrypt token");
    return bcrypt.hashAsync(token.secret, 10);
  }).then(function(hash) {
    console.log("Going to store bcrypted token");
    user.tokens[id] = hash;
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
