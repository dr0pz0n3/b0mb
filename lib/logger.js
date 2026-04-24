const winston = require('winston')

const options = {
  file: {
    level: 'info',
    filename: '/winston_logs/b0mb.log',
    handleExceptions: true,
    json: false,
    maxsize: 5242880,
    maxFiles: 5,
    colorize: false,
  },
  console: {
    level: 'debug',
    handleExceptions: true,
    json: false,
    colorize: true,
  }
};

const logger = winston.createLogger({
  levels: winston.config.npm.levels,
  transports: [
    new winston.transports.File(options.file),
    new winston.transports.Console(options.console)
  ],
  exitOnError: false
});

module.exports = logger;

