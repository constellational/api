var Promise = require('bluebird');
var AWS = require('aws-sdk');
var s3 = new AWS.S3();
Promise.promisifyAll(Object.getPrototypeOf(s3));

function getUser(bucket, key) {
  console.log("Going to get " + key + " from " + bucket);
  return s3.getObjectAsync({Bucket: bucket, Key: key}).then(function(data) {
    var s = new Buffer(data.Body).toString();
    return JSON.parse(s);
  }).catch(function() {
    return {};
  });
}

function list(username) {
  console.log("Going to list entries for " + username);
  var bucket = 'constellational-store';
  var prefix = username + '/';
  return getUser(bucket, username).then(function(user) {
    return s3.listObjectsAsync({Bucket: bucket, Prefix: prefix}).then(function(data) {
      user.articles = data.Contents.map(function(o) {
        return o.Key.substring(prefix.length);
      });
      user.articles.reverse();
      return user;
    });
  });
}

exports.handler = function(event, context) {
  console.log("Starting");
  console.log(event);
  return list(event.username).then(context.succeed).catch(context.fail);
};
