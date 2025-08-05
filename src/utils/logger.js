const winston = require('winston');
const path = require('path');
const fs = require('fs-extra');
const config = require('../config/config');

// Ensure logs directory exists
const logDir = path.dirname(config.logging.file);
fs.ensureDirSync(logDir);

const logger = winston.createLogger({
  level: config.logging.level,
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'ssh-server' },
  transports: [
    // Write all logs with level 'error' and below to error.log
    new winston.transports.File({ 
      filename: path.join(logDir, 'error.log'), 
      level: 'error' 
    }),
    // Write all logs to the main log file
    new winston.transports.File({ 
      filename: config.logging.file 
    })
  ]
});

// If we're not in production, log to the console as well
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple(),
      winston.format.printf(({ timestamp, level, message, service }) => {
        return `${timestamp} [${service}] ${level}: ${message}`;
      })
    )
  }));
}

module.exports = logger;