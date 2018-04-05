const express = require('express');
const router = express.Router();

const firebase = require("firebase-admin");
const serviceAccount = require('./firebase.json');

const dbURL = "https://ss-smtracking.firebaseio.com"
firebase.initializeApp({
  credential: firebase.credential.cert(serviceAccount),
  databaseURL: dbURL
});

const fB = firebase.database().refFromURL(dbURL);

exports.getZoneOfVehicle = (vehicle_id, done) => {
  fB.child('vehicles').on('value', snap => {
    done(snap.val()[vehicle_id])
  })
}

router.post('/savetrail', (req, res) => {
  exports.getZoneOfVehicle(req.body.vehicle_id, cb => {
    if(!cb) return res.status(404).send('Vehicle not found.')
    const data = req.body;
    data.zone_vehicle = `${cb.zone_id}_${req.body.vehicle_id}`;
    fB.child('trails').push().set(data).then(function (result) {
      return res.json({ message: 'Data submitted succesfully' })
    })
    .catch(function(e){
      return res.status(500).send(e.message);
    })
  })
})

module.exports = router;
