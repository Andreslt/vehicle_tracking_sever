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
const logger = require('./winston');

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
  if (!data) res.status(400).send('Body empty');
  exports.getCompanyOfVehicle(data.vehicle_id, async cb => {
    if (!cb) return res.status(404).send('Vehicle not found.');
    const vh = cb[Object.keys(cb)[0]];
    const company = vh.zone.slice(0, 5);
    const path = `DATA/ENTITIES/${company}/ZONES/${vh.zone}/VEHICLES/${vh.id}/TRAILS`;
    data = {
      ...data,
      sent_tsmp: moment(data.sent_tsmp).utcOffset("-05:00").format()
    };

    try {
      const lastSnap = await fB.child(path).limitToLast(1).once('value');
      let last = lastSnap.val();
      last = last ? Object.values(last) : [];
      await fB.child(path).push().set(data);
      if (last.length > 0) { // If there's a trail
        last = last[0];
        const geoFencesSnap = await fB.child(`CONTROL/GEO_FENCES/${company}`).once('value');
        const geoFences = geoFencesSnap.val();
        if (geoFences) {
          await Promise.all(Object.values(geoFences).map(async geoFence => {
            // calculate distances
            const lastDistance = geodistance(geoFence, last);
            const recentDistance = geodistance(geoFence, data);
            if (lastDistance > geoFence.radius && recentDistance <= geoFence.radius) { // vehicle enters geo-fence
              // Store event
              const pathGF = `DATA/ENTITIES/${company}/ZONES/${vh.zone}/VEHICLES/${vh.id}/GEO_FENCES`;
              await fB.child(pathGF).push().set({
                geoFence: geoFence.name,
                timestamp: data.sent_tsmp,
              });
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
            }
            // if (lastDistance < geoFence.radius && recentDistance > geoFence.radius) // vehicle leaves geo-fence
          }));
        }
      }
      logger.info('<savetrail>: Data submitted successfully');
      return res.json({ message: 'Data submitted successfully' })
    } catch (e) {
      logger.error(`<savetrail>: ${e.message}`);
      return res.status(500).send(e.message);
    }
  });
});

router.post('/saveBulk', (req, res) => {
  const data = req.body;
  logger.log(`data ->  ${data}`);
  if (!data && !data.items) res.status(400).send('Either Body or Items is empty');
  let items = Object.values(data.items);
  exports.getCompanyOfVehicle(items[0].vehicle_id, async cb => {
    if (!cb) return res.status(404).send('Vehicle not found.');
    try {
      const vh = cb[Object.keys(cb)[0]];
      const company = vh.zone.slice(0, 5);
      const path = `DATA/ENTITIES/${company}/ZONES/${vh.zone}/VEHICLES/${vh.id}/TRAILS`;
      items.sort(compare);
      for (let index = 0; index < items.length; index++) {
        const item = items[index];
        item.bulk = true
        item.sent_tsmp = moment(item.sent_tsmp).utcOffset("-05:00").format()
        try {
          const lastSnap = await fB.child(path).limitToLast(1).once('value');
          let last = lastSnap.val();
          last = last ? Object.values(last) : [];
          await fB.child(path).push().set(item);
          if (last.length > 0) { // If there's a trail            
            last = last[0];
            const geoFencesSnap = await fB.child(`CONTROL/GEO_FENCES/${company}`).once('value');            
            const geoFences = geoFencesSnap.val();
            if (geoFences) {              
              await Promise.all(Object.values(geoFences).map(async geoFence => {
                // calculate distances
                const lastDistance = geodistance(geoFence, last);
                const recentDistance = geodistance(geoFence, item);
                if (lastDistance > geoFence.radius && recentDistance <= geoFence.radius) { // vehicle enters geo-fence
                  // Store event
                  const pathGF = `DATA/ENTITIES/${company}/ZONES/${vh.zone}/VEHICLES/${vh.id}/GEO_FENCES`;
                  await fB.child(pathGF).push().set({
                    geoFence: geoFence.name,
                    timestamp: item.sent_tsmp,
                  });
                }
              }));
            }
          }
        } catch (e) {
          logger.error(`<saveBulk>: ${e.message}`);
        }
      }
      logger.info('<saveBulk>: Data submitted successfully');
      return res.json({ message: 'Data submitted successfully' })
    } catch (e) {
      logger.error(`<savetrail>: ${e.message}`);
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
      logger.info('<downloadcsv>: File downloaded');
      return res.status(200).send(csv);
    });
});

function compare(a, b) {
  const aDate = new Date(a.sent_tsmp);
  const bDate = new Date(b.sent_tsmp);
  if (aDate < bDate)
    return -1;
  if (aDate > bDate)
    return 1;
  return 0;
}

module.exports = router;
