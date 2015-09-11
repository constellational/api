var Promise = require('bluebird');
var bcrypt = Promise.promisifyAll(require('bcryptjs'));
var crypto = require('crypto');
var base64url = require('base64-url');
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
  return s3.putObjectAsync({Bucket: bucket, Key: key, Body: JSON.stringify(obj), ContentType: 'application/json'}); }

function randomString() {
  var shasum = crypto.createHash('sha1');
  shasum.update(Math.random().toString());
  return base64url.escape(shasum.digest('base64'));
}

function auth(username, token) {
  console.log("Going to check token for user " + username);
  var bucket = 'constellational-meta';
  return getObj(bucket, username).then(function(meta) {
    return bcrypt.compareAsync(token, meta.hash);
  }).then(function(res) {
    if (!res) Promise.reject('auth fail');
  });
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

function get(username, id) {
  console.log("Going to get " + id + " for " + username);
  var bucket = 'constellational-store';
  var key = username + '/' + id;
  return getObj(bucket, key);
}

function list(username) {
  console.log("Going to list entries for " + username);
  var bucket = 'constellational-store';
  var prefix = username + '/';
  return getObj(bucket, username).then(function(blog) {
    return s3.listObjectsAsync({Bucket: bucket, Prefix: prefix}).then(function(data) {
      blog.entries = data.Contents.map(function(o) {
        return o.Key.substring(prefix.length);
      });
      blog.entries.reverse();
      return blog;
    });
  });
}

function create(username, token, entry) {
  console.log("Going to create a new entry for " + username);
  delete entry.token;
  return auth(username, token).then(function() {
    var bucket = 'constellational-store';
    entry.created = new Date().toISOString();
    entry.updated = entry.created;
    if (!entry.id) entry.id = randomString();
    var key = entry.created + randomString();
    return putJSON(bucket, key, entry);
  });
}

function signup(username) {
  console.log("Going to sign " + username + " up");
  var bucket = 'constellational-meta';
  var token = randomString();
  return checkAvailable(username).then(function() {
    return bcrypt.hashAsync(token, 10);
  }).then(function(hash) {
    return putJSON(bucket, username, {hash: hash});
  }).then(function() {
    return {username: username, token: token};
  });
}

function del(username, token, id) {
  console.log("Going to delete " + id + " for " + username);
  return auth(username, token).then(function() {
    var bucket = 'constellational-store';
    return s3.deleteObjectAsync({Bucket: bucket, Key: id});
  });
}

exports.handler = function(event, context) {
  console.log(event);
  switch (event.method) {
  case 'GET':
    if (event.id) get(event.username, event.id).then(context.succeed).catch(context.fail);
    else list(event.username).then(context.succeed).catch(context.fail);
    break;
  case 'POST':
    if (event.data && event.data.token) create(event.username, event.data.token, event.data).then(context.succeed).catch(context.fail);
    else signup(event.username).then(context.succeed).catch(context.fail);
    break;
  case 'DELETE':
    del(event.username, event.token, event.id).then(context.succeed).catch(context.fail);
    break;
  }
};
