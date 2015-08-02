var Promise = require('bluebird');
var AWS = require('aws-sdk');
var s3 = new AWS.S3();

var helpers = {};

helpers.putStringified = function(bucket, key, obj) {
  return new Promise(function(resolve, reject) {
    console.log("going to put "+key+" in "+bucket);
    s3.putObject({
      Bucket: bucket,
      Key: key,
      Body: JSON.stringify(obj),
      ContentType: 'application/json'
    }, function(err, data) {
      if (err) {
        console.log("error "+err+" putting "+key+" in "+bucket);
        reject(err.toString());
      } else {
        console.log("got "+JSON.stringify(data)+" when putting "+key+" in "+bucket);
        resolve(data);
      }
    });
  });
};

helpers.getParsed = function(bucket, key) {
  return new Promise(function(resolve, reject) {
    console.log("going to get "+key+" from "+bucket);
    var params = {Bucket: bucket, Key: key};
    s3.getObject(params, function(err, data) {
      if (err) {
        console.log("error "+err+" getting "+key+" from "+bucket);
        reject(err.toString());
      } else {
        var s = new Buffer(data.Body).toString();
        console.log("got "+s+" as "+key+" from "+bucket);
        resolve(JSON.parse(s));
      }
    });
  });
};

helpers.listKeys = function(bucket, prefix) {
  return new Promise(function(resolve, reject) {
    console.log("going to list objects with prefix "+prefix+" in "+bucket);
    s3.listObjects({
      Bucket: bucket,
      Prefix: prefix
    }, function(err, data) {
      if (err) {
        console.log("error "+err+" listing objects with prefix "+prefix+" in "+bucket);
        reject(err.toString());
      } else {
        console.log("got "+JSON.stringify(data)+" when listing objects with prefix "+prefix+" in "+bucket);
        var keys = data.Contents.map(function(o) {
          return o.Key.substring(prefix.length);
        });
        keys.reverse();
        resolve(keys);
      }
    });
  });
};

helpers.delKey = function(bucket, key) {
  return new Promise(function(resolve, reject) {
    console.log("going to delete "+key+" from "+bucket);
    s3.deleteObject({
      Bucket: bucket,
      Key: key
    }, function(err, data) {
      if (err) {
        console.log("error "+err+" deleting "+key+" from "+bucket);
        reject(err.toString());
      } else {
        console.log("got "+JSON.stringify(data)+" when deleting "+key+" from "+bucket);
        resolve(data);
      }
    });
  });
};

module.exports = helpers;

