const app = require('express')();
const api = require('./api');
const bodyParser = require('body-parser');

app.use(require('cors')());
app.use(bodyParser.json());

app.use('/api', api);
app.get('/', (req, res) => {
  res.send('Welcome to the Smart-Tracking System API!')
});
app.set('port', (process.env.PORT || 8080));

app.listen(app.get('port'), function () {
  console.log('Magic happens on port: ' + app.get('port'));
});