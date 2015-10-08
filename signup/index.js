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

function checkAvailable(username) {
  console.log("Going to check if " + username + " is available");
  var bucket = 'constellational-meta';
  return new Promise(function(resolve, reject) {
    getObj(bucket, username).then(function(obj) {
      reject('Unavailable');
    }).catch(function(err) {
      if (err.code === 'NoSuchKey') resolve('Available');
      else reject(err);
    });
  });
}

function signup(username, email) {
  console.log("Going to sign " + username + " up");
  var bucket = 'constellational-meta';
  var token = {
    id: randomString(),
    secret: randomString()
  };
  var user = {tokens: {}, email: email};
  return checkAvailable(username).then(function() {
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
  signup(event.username, event.email).then(context.succeed).catch(context.fail);
};
