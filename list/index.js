var POST_BUCKET = 'constellational-posts';
var USER_BUCKET = 'constellational-users';
var META_BUCKET = 'constellational-users-meta';

var Promise = require('bluebird');
var AWS = require('aws-sdk');
var s3 = new AWS.S3();
Promise.promisifyAll(Object.getPrototypeOf(s3));

function getUser(key) {
  console.log("Going to get " + key + " from " + USER_BUCKET);
  return s3.getObjectAsync({Bucket: USER_BUCKET, Key: key}).then(function(data) {
    var s = new Buffer(data.Body).toString();
    return JSON.parse(s);
  }).catch(function() {
    return {};
  });
}

function list(username) {
  console.log("Going to list posts for " + username);
  var prefix = username + '/';
  return getUser(username).then(function(user) {
    return s3.listObjectVersionsAsync({Bucket: POST_BUCKET, Prefix: prefix}).then(function(data) {
      var latest = data.Versions.filter(function(o) {
        // After deleting objects, there seems to be a obj with size 0
        return (o.IsLatest && (o.Key !== prefix));
      });
      user.posts = latest.map(function(o) {
        return o.Key.substring(prefix.length) + '?VersionId=' + o.VersionId;
      });
      user.posts.reverse();
      return user;
    });
  });
}

function storeStaticFile(key, json) {
  console.log("Going to put " + key + " in " + USER_BUCKET);
  return s3.putObjectAsync({
    Bucket: USER_BUCKET,
    Key: key,
    Body: JSON.stringify(json),
    ContentType: 'application/json',
    ACL: 'public-read'
  });
}

exports.handler = function(event, context) {
  console.log("Starting");

  var key = event.Records[0].s3.object.key;
  console.log("The key is: "+key);
  var splitKey = key.split('/');
  var username = splitKey[0];
  if (splitKey.length < 2) context.fail("Not a post");
  else list(username).then(function(data) {
    console.log("Going to store static file");
    return storeStaticFile(username, data);
  }).then(context.succeed).catch(context.fail);
};
