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

exports.getCompanyOfVehicle = (vehicle_id, done) => {
  fB.child('CONTROL/VEHICLES').orderByChild('id').equalTo(vehicle_id).on('value', snap => {
    done(snap.val());
  })
}

router.post('/savetrail', (req, res) => {
  let data = req.body;
  exports.getCompanyOfVehicle(data.vehicle_id, cb => {
    if (!cb) return res.status(404).send('Vehicle not found.')
    const vh = cb[Object.keys(cb)[0]];
    const company = vh.zone.slice(0, 5);
    const path = `DATA/ENTITIES/${company}/ZONES/${vh.zone}/VEHICLES/${vh.id}/TRAILS`;
    data = {
      ...data,
      sent_tsmp: moment(data.sent_tsmp).format()
    }
    fB.child(path).push().set(data).then(function (result) {
      return res.json({ message: 'Data submitted succesfully' })
    })
      .catch(function (e) {
        return res.status(500).send(e.message);
      })
  })
})

router.post('/downloadcsv', (req, res) => {
  const {
    vehicle,
    startingDate,
    endingDate
  } = req.body;
  const company = vehicle.zone.slice(0, 5);
  const path = `DATA/ENTITIES/${company}/ZONES/${vehicle.zone}/VEHICLES/${vehicle.id}/TRAILS`;

  const time1 = moment(new Date());
  // console.log('*** time 1 -> ', time1.format('DD/MM HH:mm:ss'));
  fB.child(path).orderByChild('sent_tsmp').startAt(startingDate).endAt(endingDate)
    .on('value', snap => {
      const snapVal = snap.val();
      // const time2 = moment(new Date());
      // console.log('*** time 2 -> ', time2.format('DD/MM HH:mm:ss'), '.:. Diff ->', moment(time2.diff(time1)).format("m[m] s[s]"));
      if (!snapVal) return res.status(400).send({ message: 'Los resultados no contienen registros. Modifique los parámetros de búsqueda.' });
      const data = Object.values(snap.val())
      const fields = ['id', 'altitude', 'lat', 'lng', 'sent_tsmp', 'speed', 'track', 'vehicle_id', 'zone_vehicle'];
      const opts = { fields };
      // const time3 = moment(new Date());
      // console.log('*** time 3 -> ', time3.format('DD/MM HH:mm:ss'), '.:. Diff ->', moment(time3.diff(time2)).format("m[m] s[s]"));
      const csv = json2csv(data, opts);
      // const time4 = moment(new Date());
      // console.log('*** time 4 -> ', time3.format('DD/MM HH:mm:ss'), '.:. Diff ->', moment(time4.diff(time3)).format("m[m] s[s]"));

      return res.status(200).send(csv);
    })
})

module.exports = router;
