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
    var userRef = await db.collection("users").doc(user_id);
    var getDoc = userRef
      .get()
      .then(async function(doc) {
        // save user info
        console.log("saving on db!");
        let response = await saveUserInfo(req, doc, userRef);
        console.log("response sent!");
        if (response.success)
          res.json({ success: true, resource: response.resource });
        else res.json({ success: false });
      })
      .catch(err => {
        console.log("Error getting document", err);
        res.json({ success: false });
      });
  }
  // if new - GET/getUserProfile?user_id=<PSID>
  /*request.get({url:'.../getUserProfile', qs: {user_id: req.body.user_id}, json:true}, function (error, http, body) {
      console.log(body)
    })*/
});

app.post("/positive-messages", async (req, res) => {
  var user_id = req.body.user_id;
  if (user_id) {
    console.log(
      "getting existing user (",
      user_id + ")'s positive messages from db"
    );
    let response = await getPositiveMessagesForOneUser(user_id);
    if (response.success)
      res.json({ success: true, resource: response.resource });
    else res.json({ success: false });
  } else {
    // todo
    console.log("getting all users positive messages from db");
  }
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
  let user = null;
  if (!doc.exists) {
    // new user, ask for more user profile info
    request.get(
      {
        url: "https://dda49c3f.ngrok.io/api/getUserProfile",
        qs: { user_id: req.body.user_id },
        json: true
      },
      function(error, http, answer) {
        console.log("new user info: " + JSON.stringify(answer));
        if (answer.success) {
          user = answer.resource;
          userRef.set(user);
        }
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
    let response = await analyzeSentiment(message, messagesRef);
    //console.log("update db object: " + response.entities.sentiment[0].value);
    if (response.success) res({ success: true, resource: response.resource });
    else res({ success: false });
  }).catch(function() {
    console.log("saveUserInfo: Promise Rejected");
    res({ success: false });
  });
};

var analyzeSentiment = function(message, messagesRef) {
  return new Promise((res, rej) => {
    console.log("analyzing data... " + message.content);

    const client = new Wit({
      accessToken: "I2IJR67UXBGRFWCN5A72OTKMMRYNMWUM",
      logger: new log.Logger(log.DEBUG) // optional
    });

    client
      .message(message.content)
      .then(data => {
        console.log("update db object: " + data.entities.sentiment[0].value);
        db.collection("messages")
          .where("user_id", "==", message.user_id)
          .where("timestamp", "==", message.timestamp)
          .get()
          .then(function(querySnapshot) {
            querySnapshot.forEach(function(doc) {
              console.log(doc.id, " => ", doc.data());
              // Build doc ref from doc.id
              messagesRef
                .doc(doc.id)
                .update({
                  sentiment: data.entities.sentiment
                    ? data.entities.sentiment[0].value
                    : null,
                  sentiment_confidence: data.entities.sentiment
                    ? data.entities.sentiment[0].confidence
                    : null,
                  feeling: data.entities.feeling
                    ? data.entities.feeling[0].value
                    : null,
                  feeling_confidence: data.entities.feeling
                    ? data.entities.feeling[0].confidence
                    : null,
                  action: data.entities.action
                    ? data.entities.action[0].value
                    : null,
                  action_confidence: data.entities.action
                    ? data.entities.action[0].confidence
                    : null
                })
                .then(() => {
                  // update complete, let's return the data
                  messagesRef
                    .where("user_id", "==", message.user_id)
                    .where("timestamp", "==", message.timestamp)
                    .get()
                    .then(function(querySnapshot) {
                      querySnapshot.forEach(function(theDoc) {
                        console.log("++++", theDoc.data());
                        res({ success: true, resource: theDoc.data() });
                      });
                    });
                });
            });
          });
      })
      .catch(function(error) {
        res({ success: false });
      });

    // res.json({ success: true, resource: data });
  }).catch(function() {
    console.log("analyzeSentiment: Promise Rejected");
  });
};

var getPositiveMessagesForOneUser = async function(user_id) {
  return new Promise((res, rej) => {
    var positiveSentiments = [];
    db.collection("messages")
      .where("user_id", "==", user_id)
      .where("sentiment", "==", "positive")
      .get()
      .then(function(querySnapshot) {
        querySnapshot.forEach(function(doc) {
          console.log(doc.id, " => ", doc.data());
          positiveSentiments.push(doc.data());
        });
        res({ success: true, resource: positiveSentiments });
      })
      .catch(err => {
        res({ success: false });
      });
  });
};

app.listen(port, () => console.log(`Example app listening on port ${port}!`));
