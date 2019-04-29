var express = require('express');
var router = express.Router();
var request = require('request');
const PAGE_ACCESS_TOKEN = 'EAAWDmNTGYFcBAFL2HwbZAfVtTYwYBOkHgvcRN9avXXGLX9m6sOloZBFIfufZAZBlZA1KZAREIubbQtRVcn7DkkNT2K0veF1M6zAHAZBJL9hS7EtGmsIKD9ggQe1RrewoW0CzdMFIQpMMRJDYjdgN4Js3jZA4GMP9ZBcgPnvoaZA3vHcZAVb52fakpsyW1ZBNgfyNg0wZD'

router.get('/hello', (req, res) => res.send('Hello'))

router.get('/webhook', (req, res) => {
  let VERIFY_TOKEN = "f82019"

  let mode = req.query['hub.mode'];
  let token = req.query['hub.verify_token'];
  let challenge = req.query['hub.challenge'];

  console.log(mode, token, challenge);

  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('WEBHOOK_VERIFIED');
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  } else {
    res.sendStatus(403);
  }
});

router.post('/webhook', (req, res) => {
  let body = req.body;
  if (body.object === 'page') {
    body.entry.forEach(function(entry) {
      let webhook_event = entry.messaging[0];
      console.log(webhook_event);

      let sender_psid = webhook_event.sender.id;
      console.log('Sender PSID: ' + sender_psid);

      if (webhook_event.message) {
        handleMessage(sender_psid, webhook_event);
      } else if (webhook_event.postback) {
        handlePostback(sender_psid, webhook_event);
      }
    });

    res.status(200).send('EVENT_RECEIVED');
  } else {
    res.sendStatus(404);
  }
});

router.get('/getUserProfile', (req, res) => {
  if (req.query.user_id) {
    let fields = 'first_name,last_name,profile_pic,name,locale,timezone,gender';
    request({
      method: 'get',
      url: 'https://graph.facebook.com/' + req.query.user_id,
      qs: {
        fields: fields,
        access_token: PAGE_ACCESS_TOKEN
      },
      json: true
    }, (err, http, body) => {
      if (!err) {
        res.json({success: true, resource: body})
      } else {
        console.log(err);
        res.json({success: false})
      }
    })
  } else {
    res.json({success: false, message: 'No user id found.'})
  }
})

// Handles messages events
function handleMessage(sender_psid, received_message) {
  let message = received_message.message
  if (message.text) {
    response = {
      "text": message.text
    }

    request({
      "uri": "http://localhost:3000/new-message",
      "method": "POST",
      "json": {
        user_id: received_message.sender.id,
        timestamp: received_message.timestamp,
        message: message.text
      }
    }, (err, res, body) => {
      console.log(body.resource);
      console.log('sentiment:', body.resource.sentiment);
      if (!err) {
        if (body.success) {
          callSendAPI(sender_psid, body.resource.sentiment);
        } else {
          callSendAPI(sender_psid, 'Ups, something went wrong!')
        }
      } else {
        console.error("Unable to send message:" + err);
      }
    });
  }
}

// Handles messaging_postbacks events
function handlePostback(sender_psid, received_postback) {
  console.log(received_postback);
}

function callSendAPI(sender_psid, response) {
  console.log(response);
  // Construct the message body
  let request_body = {
    "recipient": {
      "id": sender_psid
    },
    "message": {
      text: 'Response: ' + response
    }
  }

  console.log(request_body);

  // Send the HTTP request to the Messenger Platform
  request({
    "uri": "https://graph.facebook.com/v2.6/me/messages",
    "qs": { "access_token": PAGE_ACCESS_TOKEN },
    "method": "POST",
    "json": request_body
  }, (err, res, body) => {
    console.log(body);
    if (!err) {
      console.log('message sent to fb!')
    } else {
      console.error("Unable to send message:" + err);
    }
  });
}

module.exports = router;
