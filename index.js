var Promise = require("bluebird");
var bcrypt = Promise.promisifyAll(require('bcryptjs'));
var s3 = require('./s3helpers');

var randomString = function() {
  var shasum = crypto.createHash('sha1');
  shasum.update(Math.random().toString());
  return base64url.escape(shasum.digest('base64'));
};

var auth = function(username, token) {
  var bucket = 'constellational-meta';
  return new Promise(function(resolve, reject) {
    s3.getParsed(bucket, username).then(function(meta) {
      return bcrypt.compare(token, meta.hash);
    }).then(function(res) {
      if (res) resolve();
      else reject('auth fail');
    });
  });
};

var checkDoesntExist = function(username) {
  var bucket = 'constellational-meta';
  return new Promise(function(resolve, reject) {
    s3.getParsed(bucket, username).then(function(obj) {
      reject("Already exists");
    }).catch(function(err) {
      if (err.indexOf('NoSuchKey') != -1) resolve();
      else reject(err);
    });
  });
};

var get = function(username, id) {
  var bucket = 'constellational-store';
  var key = username + '/' + id;
  return s3.getParsed(bucket, key);
};

var list = function(username) {
  var bucket = 'constellational-store';
  var prefix = username + '/';
  var ret;
  return s3.getParsed(bucket, username).then(function(blog) {
    ret = blog;
    return s3.listKeys(bucket, prefix);
  }).then(function(entries) {
    ret.entries = entries;
    return ret;
  });
};

var create = function(username, token, entry) {
  delete entry.token;
  return auth(username, token).then(function() {
    var bucket = 'constellational-store';
    entry.created = new Date().toISOString();
    entry.updated = entry.created;
    if (!entry.id) entry.id = randomString();
    var key = entry.created + randomString();
    return s3.putStringified(bucket, entry, key);
  });
};

var signup = function(username) {
  var bucket = 'constellational-meta';
  var meta = {};
  return checkDoesntExist(username).then(function() {
    return bcrypt.genSaltAsync(10);
  }).then(function(salt) {
    return bcrypt.hashAsync(randomString(), salt, null);
  }).then(function(hash) {
    meta.hash = hash;
    return s3.putStringified(bucket, meta, username);
  }).then(function() {
    return meta;
  });
};

var del = function(username, token, id) {
  return auth(username, token).then(function() {
    var bucket = 'constellational-store';
    return s3.delKey(bucket, id);
  });
};

exports.handler = function(event, context) {
  console.log(event);
  switch (event.method) {
  case 'GET':
    if (event.id) get(event.username, event.id).then(context.succeed).catch(context.fail);
    else list(event.username).then(context.succeed).catch(context.fail);
    break;
  case 'POST':
    if (event.data) create(event.username, event.data.token, event.data).then(context.succeed).catch(context.fail);
    else signup(event.username).then(context.succeed).catch(context.fail);
    break;
  case 'DELETE':
    del(event.username, event.token, event.id).then(context.succeed).catch(context.fail);
    break;
  }
};
