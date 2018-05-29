const express = require('express');
const router = express.Router();

const json2csv = require('json2csv').parse;
const firebase = require("firebase-admin");
const serviceAccount = require('./firebase.json');
// const fs = require('fs');
const moment = require('moment');
const geodistance = require('./geodistance');
const nodemailer = require('nodemailer');
const nmmgt = require('nodemailer-mailgun-transport');
const mailgun = require('./mailgun.json');

const dbURL = "https://ss-smtracking.firebaseio.com";
firebase.initializeApp({
  credential: firebase.credential.cert(serviceAccount),
  databaseURL: dbURL
});

const fB = firebase.database().refFromURL(dbURL);

exports.getCompanyOfVehicle = (vehicle_id, done) => {
  fB.child('CONTROL/VEHICLES').orderByChild('id').equalTo(vehicle_id).on('value', snap => {
    done(snap.val());
  })
};

router.post('/savetrail', (req, res) => {
  let data = req.body;
  console.log('<<<<--------------------------------------->>>>');
  console.log('* data 1 -> ', data);
  exports.getCompanyOfVehicle(data.vehicle_id, async cb => {
    if (!cb) return res.status(404).send('Vehicle not found.');
    const vh = cb[Object.keys(cb)[0]];
    const company = vh.zone.slice(0, 5);
    const path = `DATA/ENTITIES/${company}/ZONES/${vh.zone}/VEHICLES/${vh.id}/TRAILS`;
    data = {
      ...data,
      sent_tsmp: moment(data.sent_tsmp).utcOffset("-05:00").format()
    };
    console.log('** data 2 -> ', data);
    console.log('-------------');
    try {
      const lastSnap = await fB.child(path).limitToLast(1).once('value');
      let last = lastSnap.val();
      last = last ? Object.values(last) : [];
      console.log('*** last -> ', last);
      console.log('-------------');
      await fB.child(path).push().set(data);
      if (last.length > 0) { // If there's a trail
      console.log('>>If there is a trail ', true, '<<');
      console.log('-------------');
        last = last[0];
        const geoFencesSnap = await fB.child(`CONTROL/GEO_FENCES/${company}`).once('value');
        const geoFences = geoFencesSnap.val();
        console.log('*** geoFences -> ', geoFences);
        console.log('-------------');
        await Promise.all(Object.values(geoFences).map(async geoFence => {
          // calculate distances
          console.log('*** geoFence -> ', geoFence);
          console.log('*** last -> ', last);
          console.log('-------------');          
          const lastDistance = geodistance(geoFence, last);
          console.log('*** lastDistance -> ', lastDistance);
          const recentDistance = geodistance(geoFence, data);
          console.log('*** recentDistance -> ', recentDistance);
          console.log('-------------');
          if (lastDistance > geoFence.radius && recentDistance <= geoFence.radius) { // vehicle enters geo-fence
            console.log('>>> vehicle enters geo-fence', true, '<<<');
            console.log('-------------');  
            // Get user
            const userSnap = await fB.child(`CONTROL/USERS/${geoFence.uid}`).once('value');
            const user = userSnap.val(); // { company, email, name, role }
            const transport = nodemailer.createTransport(nmmgt({
              auth: {
                api_key: mailgun.apiKey,
                domain: mailgun.domain,
              },
            }));
            await transport.sendMail({
              from: "Smart Tracking Team <no-reply@smart.tracking.com>",
              to: user.email,
              subject: `Vehicle ${vh.id} just entered the geo-fence ${geoFence.name}`,
              html: `<div>Vehicle with ID ${vh.id} acaba de entrar al geo-fence ${geoFence.name} a las ${data.sent_tsmp}</div>
                <div>LatLng: ${data.lat}, ${data.lng}</div>`
            });
            // Store event
            const pathGF = `DATA/ENTITIES/${company}/ZONES/${vh.zone}/VEHICLES/${vh.id}/GEO_FENCES`;
            await fB.child(pathGF).push().set({
              geoFence: geoFence.name,
              timestamp: data.sent_tsmp,
            });
          }else console.log('>>> vehicle enters geo-fence', false, '<<<');
          // if (lastDistance < geoFence.radius && recentDistance > geoFence.radius) // vehicle leaves geo-fence
        }));
      }else console.log('>>If there is a trail ', false, '<<');
      return res.json({ message: 'Data submitted successfully' })
    } catch (e) {
      console.log('******** ERROR => ', e.message);
      console.log('-------------');
      return res.status(500).send(e.message);
    }
  });
});

router.post('/downloadcsv', (req, res) => {
  const {
    vehicle,
    startingDate,
    endingDate
  } = req.body;
  const company = vehicle.zone.slice(0, 5);
  const path = `DATA/ENTITIES/${company}/ZONES/${vehicle.zone}/VEHICLES/${vehicle.id}/TRAILS`;

  // const time1 = moment(new Date());
  // console.log('*** time 1 -> ', time1.format('DD/MM HH:mm:ss'));
  fB.child(path).orderByChild('sent_tsmp').startAt(startingDate).endAt(endingDate)
    .on('value', snap => {
      const snapVal = snap.val();
      // const time2 = moment(new Date());
      // console.log('*** time 2 -> ', time2.format('DD/MM HH:mm:ss'), '.:. Diff ->', moment(time2.diff(time1)).format("m[m] s[s]"));
      if (!snapVal) return res.status(400).send({ message: 'Los resultados no contienen registros. Modifique los parámetros de búsqueda.' });
      const data = Object.values(snap.val());
      const fields = ['id', 'altitude', 'lat', 'lng', 'sent_tsmp', 'speed', 'track', 'vehicle_id', 'zone_vehicle'];
      const opts = { fields };
      // const time3 = moment(new Date());
      // console.log('*** time 3 -> ', time3.format('DD/MM HH:mm:ss'), '.:. Diff ->', moment(time3.diff(time2)).format("m[m] s[s]"));
      const csv = json2csv(data, opts);
      // const time4 = moment(new Date());
      // console.log('*** time 4 -> ', time3.format('DD/MM HH:mm:ss'), '.:. Diff ->', moment(time4.diff(time3)).format("m[m] s[s]"));

      return res.status(200).send(csv);
    });
});

module.exports = router;
