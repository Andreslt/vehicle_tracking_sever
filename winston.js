const winston = require('winston');
const CloudWatchTransport = require('winston-aws-cloudwatch');
require('dotenv').config()

// define the custom settings for each transport (file, console)
const options = {
  file: {
    level: 'info',
    filename: `${__dirname}/logs/app.log`,
    handleExceptions: true,
    json: true,
    maxsize: 5242880, // 5MB
    maxFiles: 5,
    colorize: false,
  },
  console: {
    level: 'debug',
    handleExceptions: true,
    json: false,
    colorize: true,
  },
};

// instantiate a new Winston Logger with the settings defined above
const logger = new winston.Logger({
  transports: [
    new winston.transports.File(options.file),
    new winston.transports.Console(options.console)
  ],
  exitOnError: false, // do not exit on handled exceptions
});

const config = {
    logGroupName: 'smart_tracking_app', // REQUIRED
    logStreamName: 'appLogs', // REQUIRED
    createLogGroup: true,
    createLogStream: true,
    submissionInterval: 2000,
    submissionRetryCount: 1,
    batchSize: 20,
    awsConfig: {
      accessKeyId:  process.env.CLOUDWATCH_ACCESS_KEY_ID,
      secretAccessKey: process.env.CLOUDWATCH_SECRET_ACCESS_KEY,
      region: process.env.CLOUDWATCH_REGION
    },
    formatLog: function (item) {
      return item.level + ': ' + item.message + ' ' + JSON.stringify(item.meta)
    }
}
console.log('process.env.CLOUDWATCH_ACCESS_KEY_ID -> ', process.env.CLOUDWATCH_ACCESS_KEY_ID);
console.log('process.env.CLOUDWATCH_SECRET_ACCESS_KEY -> ', process.env.CLOUDWATCH_SECRET_ACCESS_KEY);
console.log('process.env.CLOUDWATCH_REGION -> ', process.env.CLOUDWATCH_REGION);
logger.add(CloudWatchTransport, config);

// create a stream object with a 'write' function that will be used by `morgan`
logger.stream = {
  write: function(message, encoding) {
    // use the 'info' log level so the output will be picked up by both transports (file and console)
    logger.info(message);    
  },
};

module.exports = logger;