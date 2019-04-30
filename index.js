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
});

app.post("/sentiment-messages", async (req, res) => {
  var user_id = null
  for (let query of req.body.queries) {
    if (query != null && query.field == "user_id") {
      user_id = query.value
    }
  }
  //var user_id = (req.body.queries != null && req.body.queries[0] != null && req.body.queries[0].value != nul) ? req.body.queries[0].value : null; // the first query if for the user_id
  if (user_id != null) {
     console.log("getting existing user (", user_id + ")'s positive or negative messages from db")
     let response = await getSentimentSpecificMessagesForOneUser(req.body);
     if (response.success)
      res.json({ success: true, resource: response.resource });
     else
      res.json({ success: false })
  }
  else {
    console.log("getting all users positive or negative messages from db")
    let response = await getSentimentSpecificMessagesForAllUsers(req.body);
    if (response.success)
      res.json({ success: true, resource: response.resource });
    else
      res.json({ success: false })
  }
});

var saveUserInfo = async function(req, doc, userRef) {
  let user = null;
  if (!doc.exists) {
    // new user, ask for more user profile info
    request.get(
      {
        url: "https://656e0bf4.ngrok.io/backend/api/getUserProfile",
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

  return new Promise(async (res, rej) => {
    let response = await analyzeSentiment(message, messagesRef);
    if (response.success)
      res({ success: true, resource: response.resource });
    else
      res({ success: false })
  })
  .catch(function () {
     console.log("saveUserInfo: Promise Rejected");
     res({ success: false })
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
        console.log("update db object");

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
                      //console.log("++++", theDoc.data())
                      res({ success: true, resource: theDoc.data() });
                    })
                  });
                })
            });
        });
      }).catch(function(error) {
          res({ success: false })
      });

    // res.json({ success: true, resource: data });
  }).catch(function() {
    console.log("analyzeSentiment: Promise Rejected");
  });
};

var getSentimentSpecificMessagesForOneUser = async function(body) {
  return new Promise((res, rej) => {
      var messages = []
      let queries = body.queries

      db.collection("messages")
      .where(queries[0].field, queries[0].operator, queries[0].value)
      .get()
      .then(function(querySnapshot) {
          querySnapshot.forEach(function(doc) {
            if(doc.data().sentiment == queries[1].value) {
              console.log(doc.id, " => ", doc.data());
              messages.push(doc.data())
            }
          });
          res({ success: true, resource: messages });
       })
       .catch(err => {
          res({ success: false })
       });
  })
}

var getSentimentSpecificMessagesForAllUsers = async function(body) {
  return new Promise((res, rej) => {
      var messages = []
      let query = db.collection("messages")
      for (let q of body.queries) {
         if(q.field == "sentiment") {
          query.where(q.field, q.operator, q.value)
         }
      }

      query.get()
      .then(function(querySnapshot) {
          querySnapshot.forEach(function(doc) {
              console.log(doc.id, " => ", doc.data());
              messages.push(doc.data())
          });
          res({ success: true, resource: messages });
     })
     .catch(err => {
        res({ success: false })
     });
  })
}

app.listen(port, () => console.log(`Example app listening on port ${port}!`));
