var POST_BUCKET = 'constellational-posts';
var USER_BUCKET = 'constellational-users';
var META_BUCKET = 'constellational-users-meta';

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

function putJSON(bucket, key, obj, acl) {
  console.log("Going to put " + key + " into " + bucket);
  var params = {Bucket: bucket, Key: key, Body: JSON.stringify(obj), ContentType: 'application/json'};
  if (acl) params.ACL = acl;
  return s3.putObjectAsync(params); 
}

function randomString() {
  return base64url.escape(crypto.randomBytes(48).toString('base64'));
}

function checkAvailable(username) {
  console.log("Going to check if " + username + " is available");
  return new Promise(function(resolve, reject) {
    getObj(META_BUCKET, username).then(function(obj) {
      reject('Unavailable');
    }).catch(function(err) {
      if (err.code === 'NoSuchKey') resolve('Available');
      else reject(err);
    });
  });
}

function signup(username, email) {
  var username = username.toLowerCase();
  console.log("Going to sign " + username + " up");
  var token = {
    id: randomString(),
    secret: randomString()
  };
  var user = {tokens: {}};
  return checkAvailable(username).then(function() {
    console.log("Going to bcrypt token");
    return bcrypt.hashAsync(token.secret, 10);
  }).then(function(hash) {
    user.tokens[token.id] = hash;
    console.log("Going to bcrypt email");
    return bcrypt.hashAsync(email, 10);
  }).then(function(hash) {
    user.emailHash = hash;
    console.log("Going to store user details");
    return putJSON(META_BUCKET, username, user);
  }).then(function() {
    console.log("Going to store blank user page");
    // this is so that there will be a static page for the user from the start
    // even if there is nothing on it yet
    return putJSON(USER_BUCKET, username, {}, 'public-read');
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
