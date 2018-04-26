const express = require('express');
const router = express.Router();

const json2csv = require('json2csv').parse;
const firebase = require("firebase-admin");
const serviceAccount = require('./firebase.json');
const fs = require('fs');
const moment = require('moment');

const dbURL = "https://ss-smtracking.firebaseio.com"
firebase.initializeApp({
  credential: firebase.credential.cert(serviceAccount),
  databaseURL: dbURL
});

const fB = firebase.database().refFromURL(dbURL);

exports.getZoneOfVehicle = (vehicle_id, done) => {
  fB.child('vehicles').on('value', snap => {
    const vehicles = snap.val();
    let vehArray = [], vehiclePicked;
    Object.keys(vehicles).map(key => {
      vehArray.push(vehicles[key]);
    })
    vehiclePicked = vehArray.filter(key => { return key.id === vehicle_id });
    if (!!vehiclePicked) done(vehiclePicked[0])
  })
}

router.post('/savetrail', (req, res) => {
  exports.getZoneOfVehicle(req.body.vehicle_id, cb => {
    if (!cb) return res.status(404).send('Vehicle not found.')
    const data = req.body;
    data.zone_vehicle = `${cb.zone_id}_${req.body.vehicle_id}`;
    fB.child('trails').push().set(data).then(function (result) {
      return res.json({ message: 'Data submitted succesfully' })
    })
      .catch(function (e) {
        return res.status(500).send(e.message);
      })
  })
})

router.post('/downloadcsv', (req, res) => {
  const time1 = moment(new Date());
  // console.log('*** time 1 -> ', time1.format('DD/MM HH:mm:ss'));
  fB.child('trails').orderByChild('sent_tsmp').startAt(req.body.startingDate).endAt(req.body.endingDate)
    .on('value', snap => {
      const snapVal = snap.val();
      const time2 = moment(new Date());
      // console.log('*** time 2 -> ', time2.format('DD/MM HH:mm:ss'), '.:. Diff ->', moment(time2.diff(time1)).format("m[m] s[s]"));
      if (!snapVal) return res.status(400).send({ message: 'Los resultados no contienen registros. Modifique los parámetros de búsqueda.' });
      const data = Object.values(snap.val())
      const fields = ['id', 'altitude', 'latitude', 'longitude', 'sent_tsmp', 'speed', 'track', 'vehicle_id', 'zone_vehicle'];
      const opts = { fields };
      const time3 = moment(new Date());
      // console.log('*** time 3 -> ', time3.format('DD/MM HH:mm:ss'), '.:. Diff ->', moment(time3.diff(time2)).format("m[m] s[s]"));
      const csv = json2csv(data, opts);
      const time4 = moment(new Date());
      // console.log('*** time 4 -> ', time3.format('DD/MM HH:mm:ss'), '.:. Diff ->', moment(time4.diff(time3)).format("m[m] s[s]"));
      
      return res.status(200).send(csv);
    })
})

module.exports = router;
