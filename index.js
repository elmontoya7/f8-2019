const express = require('express')
const app = express()
const port = 3000
var bodyParser = require('body-parser')
const request = require('request');


// initialize firestore db
const admin = require('firebase-admin');
var serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
var db = admin.firestore();

app.use(bodyParser.json({limit: '20mb'}));
app.use(bodyParser.urlencoded({ limit: '20mb', extended: true }));

// messenger api module
app.use('/api', require('./messenger'))
app.get('/', (req, res) => res.send('Hello World!'))

app.post('/new-message', async (req, res) => {
  // if user is new, get basic profile info first
  var user_id = req.body.user_id
  if (user_id) {
    var userRef = db.collection('users').doc(user_id)
    var getDoc = userRef.get()
    .then(doc => {
        if (!doc.exists) {
            // new user
            request.get({url:'.../getUserProfile', qs: {user_id: req.body.user_id}, json:true}, function (error, http, user) {
              user = {
                  "user_id": "ada",
                  "message": "hello",
                  "timestamp": 3287428734
              }
              let response = /*await*/ saveOrUpdateUserInfo(user)
              console.log('response sent!');
              res.json({success: true, resource: response})
            })
        } else {
            // existing user
            var user = doc.data()
            let response = /*await*/ saveOrUpdateUserInfo(user)
            console.log('response sent!');
            res.json({success: true, resource: response})
        }
    })
    .catch(err => {
        console.log('Error getting document', err);
    });
  }
  // if new - GET/getUserProfile?user_id=<PSID>
    /*request.get({url:'.../getUserProfile', qs: {user_id: req.body.user_id}, json:true}, function (error, http, body) {
      console.log(body)
    })*/
})

var saveOrUpdateUserInfo = async function (user) {
  console.log('saving on db!');
  var userRef = db.collection('users').doc(user.user_id)
  userRef.set(user);

  var message = {
    user_id: user.user_id,
    content: user.message,
    timestamp: user.timestamp
  }
  var messagesRef = db.collection('messages')
  messagesRef.add(message)

  /*var messagesRef = db.collection('messages').doc(user.user_id)
  messagesRef.set({
    user_id: user.user_id,
    messages: db.firestore.FieldValue.arrayUnion(message)
  }, { merge: true })*/

  return new Promise (async (res, rej) => {
    let response = await analyzeSentiment()
    console.log('update db object');
    res({success: true, message: response.text})
  })
}

var analyzeSentiment = function () {
  return new Promise((res, rej) => {
    setTimeout(function () {
      console.log('analyzing data...');
      res({text: 'Are you ok?'})
    }, 2000);
  })
}

app.listen(port, () => console.log(`Example app listening on port ${port}!`))
