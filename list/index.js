var BUCKET = 'constellational-store';
var Promise = require('bluebird');
var AWS = require('aws-sdk');
var s3 = new AWS.S3();
Promise.promisifyAll(Object.getPrototypeOf(s3));

function getUser(key) {
  console.log("Going to get " + key + " from " + bucket);
  return s3.getObjectAsync({Bucket: BUCKET, Key: key}).then(function(data) {
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
  return getUser(username).then(function(user) {
    return s3.listObjectVersionsAsync({Bucket: BUCKET, Prefix: prefix}).then(function(data) {
      var latest = data.Versions.filter(function(o) {
        return o.IsLatest;
      });
      user.articles = latest.map(function(o) {
        return o.Key.substring(prefix.length) + '?VersionId=' + o.VersionId;
      });
      user.articles.reverse();
      return user;
    });
  });
}

function storeStaticFile(key, json) {
  console.log("Going to put " + key + " in " + BUCKET);
  return s3.putObjectAsync({
    Bucket: BUCKET,
    Key: key,
    Body: JSON.stringify(json),
    ContentType: 'application/json',
    ACL: 'public-read'
  });
}

exports.handler = function(event, context) {
  console.log("Starting");
  console.log(event);
  var key = event.Records[0].s3.object.key;
  console.log("The key is: "+key);
  if (splitKey.length < 2) context.fail("Not an entry");
  var username = splitKey[0];
  return list(username).then(function(data) {
    console.log("Going to store static file");
    return storeStaticFile(username, data);
  }).then(context.succeed).catch(context.fail);
};
