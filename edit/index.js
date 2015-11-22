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
      return bcrypt.compareAsync(token.secret, meta.tokens[token.id]);
    }).then(function(res) {
      if (!res) reject('Authentication Failed');
      else resolve();
    });
  });
}

function edit(username, token, key, post) {
  var username = username.toLowerCase();
  console.log("Going to edit a post");
  var bucket = 'constellational-store';
  delete post.token;
  return auth(username, token).then(function() {
    console.log("Getting old post");
    return getObj(bucket, username + '/' + key).then(function(oldPost) {
      post.created = oldPost.created;
      post.updated = new Date().toISOString();
      if (!post.type) post.type = oldPost.type;
      if (!post.data) post.data = oldPost.data;
      console.log("Storing new post");
      return putJSON(bucket, username + '/' + key, post);
    }).then(function(data) {
      post.url = key + '?VersionId=' + data.VersionId;
      return post;
    });
  });
}

exports.handler = function(event, context) {
  console.log("Started");
  if (!event.data || !event.data.token) context.fail('Bad Request');
  else edit(event.username, event.data.token, event.key, event.data).then(context.succeed).catch(context.fail);
};
