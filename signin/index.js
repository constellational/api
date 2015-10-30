require('dotenv').load();

var crypto = require('crypto');
var base64url = require('base64-url');
var Promise = require('bluebird');
var bcrypt = Promise.promisifyAll(require('bcryptjs'));
var AWS = require('aws-sdk');

var s3 = new AWS.S3();
Promise.promisifyAll(Object.getPrototypeOf(s3));

var mandrill = require('mandrill-api/mandrill');
var mandrill_client = new mandrill.Mandrill(process.env.MANDRILL_API_KEY);

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
  return base64url.escape(crypto.randomBytes(48).toString('base64'));
}

function checkEmail(username, email) {
  console.log("Going to check email for " + username);
  var bucket = 'constellational-meta';
  return new Promise(function(resolve, reject) {
    return getObj(bucket, username).then(function(obj) {
      return bcrypt.compareAsync(email, obj.emailHash);
    }).then(function(res) {
      if (!res) reject('Signin failed');
      else resolve(obj);
    });
  });
}

function sendEmail(username, email, token) {
  var escapedToken = base64url.encode(JSON.stringify(token));
  var link = APP_URL + '/signin?token=' + escapedToken;
  var message = {
    html: '<p>Hi there!</p><p>Click <a href=' + link + '>here to sign in</a></p><p>If clicking that does not work, paste the following in your phone browser: </p><p>'+link+'</p>',
    subject: 'Sign in to Constellational',
    from_email: 'signin@constellational.com',
    from_name: 'Constellational Sign In',
    to: [{
      email: email,
      type: 'to'
    }],
    headers: {
      Reply-To: 'arpith@constellational.com'
    }
  };
  return new Promise(function(resolve, reject) {
    mandrill_client.messages.send({message: message}, function(res) {
      if (res[0].reject_reason) reject(res[0]);
      else resolve(res[0]);
    }, function(err) {
      reject(err);
    });
  });
}

function signin(username, email) {
  console.log("Going to sign " + username + " in");
  var user;
  var bucket = 'constellational-meta';
  var token = {
    id: randomString(),
    secret: randomString()
  };
  return checkEmail(username, email).then(function(details) {
    user = details;
    console.log("Going to bcrypt temporary token");
    return bcrypt.hashAsync(token.secret, 10);
  }).then(function(hash) {
    if (!user.tempTokens) user.tempTokens = {};
    user.tempTokens[id] = {hash: hash, created: Date.now()});
    console.log("Going to store bcrypted hash of temporary token");
    return putJSON(bucket, username, user);
  }).then(function() {
    console.log("Going to send email");
    return sendEmail(username, email, token);
  });
}

exports.handler = function(event, context) {
  console.log("Started");
  console.log(event);
  signin(event.username, event.email).then(context.succeed).catch(context.fail);
};
