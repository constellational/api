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

function sendEmail(username, email) {
/*
  var message = {
    "html": "<p>Example HTML content</p>",
    "text": "Example text content",
    "subject": "example subject",
    "from_email": "message.from_email@example.com",
    "from_name": "Example Name",
    "to": [{
            "email": "recipient.email@example.com",
            "name": "Recipient Name",
            "type": "to"
        }],
    "headers": {
        "Reply-To": "message.reply@example.com"
    },
    "important": false,
    "track_opens": null,
    "track_clicks": null,
    "auto_text": null,
    "auto_html": null,
    "inline_css": null,
    "url_strip_qs": null,
    "preserve_recipients": null,
    "view_content_link": null,
    "bcc_address": "message.bcc_address@example.com",
    "tracking_domain": null,
    "signing_domain": null,
    "return_path_domain": null,
    "merge": true,
    "merge_language": "mailchimp",
    "global_merge_vars": [{
            "name": "merge1",
            "content": "merge1 content"
        }],
    "merge_vars": [{
            "rcpt": "recipient.email@example.com",
            "vars": [{
                    "name": "merge2",
                    "content": "merge2 content"
                }]
        }],
    "tags": [
        "password-resets"
    ],
    "subaccount": "customer-123",
    "google_analytics_domains": [
        "example.com"
    ],
    "google_analytics_campaign": "message.from_email@example.com",
    "metadata": {
        "website": "www.example.com"
    },
    "recipient_metadata": [{
            "rcpt": "recipient.email@example.com",
            "values": {
                "user_id": 123456
            }
        }],
    "attachments": [{
            "type": "text/plain",
            "name": "myfile.txt",
            "content": "ZXhhbXBsZSBmaWxl"
        }],
    "images": [{
            "type": "image/png",
            "name": "IMAGECID",
            "content": "ZXhhbXBsZSBmaWxl"
        }]
};
var async = false;
var ip_pool = "Main Pool";
var send_at = "example send_at";
mandrill_client.messages.send({"message": message, "async": async, "ip_pool": ip_pool, "send_at": send_at}, function(result) {
    console.log(result);
}, function(e) {
    // Mandrill returns the error as an object with name and message keys
    console.log('A mandrill error occurred: ' + e.name + ' - ' + e.message);
    // A mandrill error occurred: Unknown_Subaccount - No subaccount exists with the id 'customer-123'
});
*/
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
    return {username: username, token: token};
  });
}

exports.handler = function(event, context) {
  console.log("Started");
  console.log(event);
  signup(event.username).then(context.succeed).catch(context.fail);
};
