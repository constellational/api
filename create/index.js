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
  var params = {Bucket: bucket, Key: key, Body: JSON.stringify(obj), ContentType: 'application/json', ACL: 'public-read'};
  return s3.putObjectAsync(params); 
}

function randomString() {
  return base64url.escape(crypto.randomBytes(6).toString('base64'));
}

function auth(username, token) {
  console.log("Going to check token for user " + username);
  var bucket = 'constellational-meta';
  return new Promise(function(resolve, reject) {
    return getObj(bucket, username).then(function(meta) {
      return bcrypt.compareAsync(token.secret, meta.tokens[token.id].hash);
    }).then(function(res) {
      if (!res) reject('Authentication Failed');
      else resolve();
    });
  });
}

function create(username, token, post) {
  console.log("Going to create a new post for " + username);
  delete post.token;
  return auth(username, token).then(function() {
    var bucket = 'constellational-store';
    post.created = new Date().toISOString();
    post.updated = post.created;
    if (!post.id) post.id = randomString();
    post.key = post.created + post.id;
    return putJSON(bucket, username + '/' + post.key, post).then(function(data) {
      post.url = post.key + '?VersionId=' + data.VersionId;
      return post;
    });
  });
}

exports.handler = function(event, context) {
  console.log("Started");
  console.log(event);
  if (!event.data || !event.data.token) context.fail('Bad Request');
  else create(event.username, event.data.token, event.data).then(context.succeed).catch(context.fail);
};
