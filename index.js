const express = require('express')
const app = express()
const port = 3000
var bodyParser = require('body-parser')

app.use(bodyParser.json({limit: '20mb'}));
app.use(bodyParser.urlencoded({ limit: '20mb', extended: true }));

// messenger api module
app.use('/api', require('./messenger'))
app.get('/', (req, res) => res.send('Hello World!'))

app.post('/new-message', async (req, res) => {
  let response = await saveMessageOnDB()
  console.log('response sent!');
  res.json({success: true, resource: response})
})

var saveMessageOnDB = async function () {
  console.log('saving on db!');
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
