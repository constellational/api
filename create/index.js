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
  return new Promise(function(resolve, reject) {
    return getObj(META_BUCKET, username).then(function(meta) {
      return bcrypt.compareAsync(token.secret, meta.tokens[token.id]);
    }).then(function(res) {
      if (!res) reject('Authentication Failed');
      else resolve();
    });
  });
}

function checkHasChanged(username, key, post) {
  return new Promise(function(resolve, reject) {
    if (!key) {
      resolve('No Key');
    } else {
      getObj(POST_BUCKET, username + '/' + key).then(function(existingPost) {
        if (existingPost.data === post.data) reject('Post already stored');
        else resolve('Post has changed');
      }).catch(function(err) {
        if (err.code === 'NoSuchKey') resolve('Post not stored');
        else resolve('Couldn\'t check post');
      });
    }
  });
}

function create(username, token, post) {
  var username = username.toLowerCase();
  console.log("Going to create a new post for " + username);
  delete post.token;
  return auth(username, token).then(function() {
    post.created = new Date().toISOString();
    post.updated = post.created;
    post.username = username;
    if (!post.id) post.id = randomString();
    if (!post.key) post.key = post.created + post.id;
    return checkHasChanged(username, post.key, post).then(function() {
      return putJSON(POST_BUCKET, username + '/' + post.key, post).then(function(data) {
        post.url = post.key + '?VersionId=' + data.VersionId;
        return post;
      });
    });
  });
}

exports.handler = function(event, context) {
  console.log("Started");
  console.log(event);
  if (!event.data || !event.data.token) context.fail('Bad Request');
  else create(event.username, event.data.token, event.data).then(context.succeed).catch(context.fail);
};
