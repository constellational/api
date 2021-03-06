var POST_BUCKET = 'constellational-posts';
var USER_BUCKET = 'constellational-users';
var META_BUCKET = 'constellational-users-meta';

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

function deleteAllVersions(username, key) {
  console.log("Going to delete all versions of post");
  var params = {Bucket: POST_BUCKET, Prefix: username + '/' + key};
  return s3.listObjectVersionsAsync(params).then(function(data) {
    var promiseArr = data.Versions.map(function(obj) {
      console.log("Going to delete version " + obj.VersionId + " of key " + obj.Key);
      return s3.deleteObjectAsync({Bucket: params.Bucket, Key: obj.Key, VersionId: obj.VersionId});
    });
    return Promise.all(promiseArr);
  });
}

function del(username, token, key) {
  var username = username.toLowerCase();
  console.log("Going to delete post");
  return auth(username, token).then(function() {
    return deleteAllVersions(username, key);
  }).then(function() {
    return {key: key, success: 'true'};
  });
}

exports.handler = function(event, context) {
  console.log("Started");
  if (!event.data || !event.data.token) context.fail('Bad Request');
  else del(event.username, event.data.token, event.key).then(context.succeed).catch(context.fail);
};
