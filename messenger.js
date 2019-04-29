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

  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('WEBHOOK_VERIFIED');
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  }
});

router.post('/webhook', (req, res) => {
  let body = req.body;
  console.log(body);
  if (body.object === 'page') {
    body.entry.forEach(function(entry) {
      let webhook_event = entry.messaging[0];
      console.log(webhook_event);

      let sender_psid = webhook_event.sender.id;
      console.log('Sender PSID: ' + sender_psid);

      if (webhook_event.message) {
        handleMessage(sender_psid, webhook_event.message);
      } else if (webhook_event.postback) {
        handlePostback(sender_psid, webhook_event.postback);
      }
    });

    res.status(200).send('EVENT_RECEIVED');
  } else {
    res.sendStatus(404);
  }
});

// Handles messages events
function handleMessage(sender_psid, received_message) {
  let response;
    if (received_message.text) {
      response = {
        "text": `You sent the message: "${received_message.text}". Now send me an image!`
      }
    }

    callSendAPI(sender_psid, response);
}

// Handles messaging_postbacks events
function handlePostback(sender_psid, received_postback) {
  console.log(received_postback);
}

function callSendAPI(sender_psid, response) {
  // Construct the message body
  let request_body = {
    "recipient": {
      "id": sender_psid
    },
    "message": response
  }

  // Send the HTTP request to the Messenger Platform
  request({
    "uri": "https://graph.facebook.com/v2.6/me/messages",
    "qs": { "access_token": PAGE_ACCESS_TOKEN },
    "method": "POST",
    "json": request_body
  }, (err, res, body) => {
    if (!err) {
      console.log('message sent!')
    } else {
      console.error("Unable to send message:" + err);
    }
  });
}

module.exports = router;
