var Promise = require("bluebird");
var bcrypt = Promise.promisifyAll(require('bcrypt-nodejs'));
var s3 = require('./s3helpers');

var auth = function(author, token) {
  var bucket = 'constellational-meta';
  return new Promise(function(resolve, reject) {
    s3.getParsed(bucket, author).then(function(meta) {
      return bcrypt.compare(token, meta.hash);
    }).then(function(res) {
      if (res) resolve();
      else reject('auth fail');
    });
  });
};

var checkDoesntExist = function(author) {
  var bucket = 'constellational-meta';
  return new Promise(function(resolve, reject) {
    s3.getParsed(bucket, author).then(function(obj) {
      reject("Already exists");
    }).catch(function(err) {
      if (err.indexOf('NoSuchKey') != -1) resolve();
      else reject(err);
    });
  });
};

var get = function(author, id) {
  var bucket = 'constellational-store';
  var key = author + '/' + id;
  return s3.getParsed(bucket, key);
};

var list = function(author) {
  var bucket = 'constellational-store';
  var prefix = author + '/';
  var ret;
  return s3.getParsed(bucket, author).then(function(blog) {
    ret = blog;
    return s3.listKeys(bucket, prefix);
  }).then(function(entries) {
    ret.entries = entries;
    return ret;
  });
};

var create = function(author, token, entry) {
  return auth(author, token).then(function() {
    var bucket = 'constellational-store';
    entry.created = new Date().toISOString();
    entry.updated = entry.created;
    if (!entry.id) entry.id = randomString();
    var key = entry.created + randomString();
    return s3.putStringified(bucket, entry, key);
  });
};

var signup = function(author) {
  var bucket = 'constellational-meta';
  var meta = {};
  return checkDoesntExist(author).then(function() {
    return bcrypt.genSaltAsync(10);
  }).then(function(salt) {
    return bcrypt.hashAsync(randomString(), salt, null);
  }).then(function(hash) {
    meta.hash = hash;
    return s3.putStringified(bucket, meta, author);
  }).then(function() {
    return meta;
  });
};

var del = function(author, token, id) {
  return auth(author, token).then(function() {
    var bucket = 'constellational-store';
    return s3.delKey(bucket, id);
  });
};

exports.handler = function(event, context) {
  console.log(event);
  switch (event.method) {
  case 'GET':
    if (event.id) get(event.author, event.id).then(context.succeed).catch(context.fail);
    else list(event.author).then(context.succeed).catch(context.fail);
    break;
  case 'POST':
    if (event.token) create(event.author, event.token, event.entry).then(context.succeed).catch(context.fail);
    else signup(event.author).then(context.succeed).catch(context.fail);
    break;
  case 'DELETE':
    del(event.author, event.token, event.id).then(context.succeed).catch(context.fail);
    break;
  }
};
