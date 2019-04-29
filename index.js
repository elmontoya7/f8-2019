const express = require("express");
const { Wit, log } = require("node-wit");

const app = express();
const port = 3000;
var bodyParser = require("body-parser");
const request = require("request");

// initialize firestore db
const admin = require("firebase-admin");
var serviceAccount = require("./serviceAccountKey.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
var db = admin.firestore();

app.use(bodyParser.json({ limit: "20mb" }));
app.use(bodyParser.urlencoded({ limit: "20mb", extended: true }));

// messenger api module
app.use("/api", require("./messenger"));
app.get("/", (req, res) => res.send("Hello World!"));

app.post("/new-message", async (req, res) => {
  // if user is new, get basic profile info first
  var user_id = req.body.user_id;
  if (user_id) {
    var userRef = db.collection("users").doc(user_id);
    var getDoc = userRef
      .get()
      .then(async function(doc) {
        // save user info
        console.log("saving on db!");
        let response = await saveUserInfo(req, doc, userRef);

        console.log("response sent!");
        res.json({ success: true, resource: response });
      })
      .catch(err => {
        console.log("Error getting document", err);
      });
  }
  // if new - GET/getUserProfile?user_id=<PSID>
  /*request.get({url:'.../getUserProfile', qs: {user_id: req.body.user_id}, json:true}, function (error, http, body) {
      console.log(body)
    })*/
});

app.post("/sentiment", (req, res) => {
  // console.log("req:", req.param);
  console.log("req query:", req.query);
  var phrase = req.query.phrase;
  console.log("phrase:", phrase);
  const client = new Wit({
    accessToken: process.env.WIT_TOKEN,
    logger: new log.Logger(log.DEBUG) // optional
  });

  client
    .message(phrase)
    .then(data => {
      console.log("Yay, got Wit.ai response: " + JSON.stringify(data));
    })
    .catch(console.error);
  // res.json({ success: true, resource: response });
});

var saveUserInfo = async function(req, doc, userRef) {
  let user = null
  if (!doc.exists) {
    // new user, ask for more user profile info
    request.get(
      {
        url: ".../getUserProfile",
        qs: { user_id: req.body.user_id },
        json: true
      },
      function(error, http, user) {
        //user = user.resource
        user = 
        {
          "user_id":"934865",
          "first_name": "Ellen",
          "last_name": "L.",
          "profile_pic": "https://fbcdn-profile-a.akamaihd.net/hprofile-ak-xpf1/v/t1.0-1/p200x200/13055603_10105219398495383_8237637584159975445_n.jpg?oh=1d241d4b6d4dac50eaf9bb73288ea192&oe=57AF5C03&__gda__=1470213755_ab17c8c8e3a0a447fed3f272fa2179ce",
          "locale": "en_US",
          "timezone": -7,
          "gender": "female"
        }
        userRef.set(user);
      }
    );
  } else {
    // existing user
    user = doc.data();
  }

  // save message
  var message = {
    user_id: req.body.user_id,
    content: req.body.message,
    timestamp: req.body.timestamp
  };
  var messagesRef = db.collection("messages");
  messagesRef.add(message);

  /*var messagesRef = db.collection('messages').doc(user.user_id)
  messagesRef.set({
    user_id: user.user_id,
    messages: db.firestore.FieldValue.arrayUnion(message)
  }, { merge: true })*/

  return new Promise(async (res, rej) => {
    let response = await analyzeSentiment();
    console.log("update db object");
    res({ success: true, message: response.text });
  });
};

var analyzeSentiment = function() {
  return new Promise((res, rej) => {
    setTimeout(function() {
      console.log("analyzing data...");
      res({ text: "Are you ok?" });
    }, 2000);
  });
};

app.listen(port, () => console.log(`Example app listening on port ${port}!`));