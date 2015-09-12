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
  console.log("Going to generate random string");
  var shasum = crypto.createHash('sha1');
  shasum.update(Math.random().toString());
  return base64url.escape(shasum.digest('base64'));
}

function auth(username, token) {
  console.log("Going to check token for user " + username);
  var bucket = 'constellational-meta';
  return new Promise(function(resolve, reject) {
    return getObj(bucket, username).then(function(meta) {
      return bcrypt.compareAsync(token, meta.hash);
    }).then(function(res) {
      if (!res) reject('Authentication Failed');
      else resolve();
    });
  });
}

function create(username, token, article) {
  console.log("Going to create a new article for " + username);
  delete article.token;
  return auth(username, token).then(function() {
    var bucket = 'constellational-store';
    article.created = new Date().toISOString();
    article.updated = article.created;
    if (!article.id) article.id = randomString();
    var key = article.created + randomString();
    return putJSON(bucket, key, article).then(function() {
      article.key = key;
      return article;
    });
  });
}

exports.handler = function(event, context) {
  console.log("Started");
  console.log(event);
  if (!event.data || !event.data.token) context.fail('Bad Request');
  else create(event.username, event.data.token, event.data).then(context.succeed).catch(context.fail);
};
