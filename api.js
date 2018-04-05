const express = require('express');
const router = express.Router();

const firebase = require("firebase-admin");
const serviceAccount = require('./firebase.json');

const dbURL = "https://ss-smtracking.firebaseio.com"
firebase.initializeApp({
  credential: firebase.credential.cert(serviceAccount),
  databaseURL: dbURL
});

router.post('/savetrail', (req, res) => {
    const dbRef = firebase.database().refFromURL(dbURL);
    const colRef = dbRef.child('trails');
    colRef.push().set(req.body.data).then(function (result) {
      return res.json({ message: 'Data submitted succesfully' })
    })
  })

module.exports = router;
