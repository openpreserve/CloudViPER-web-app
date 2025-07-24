import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../../logs');

// SQL Logger configuration
const sqlTransport = new DailyRotateFile({
  filename: path.join(logsDir, 'sql-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '7d', // Keep logs for 7 days
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, message }) => {
      return `${timestamp} - ${message}`;
    })
  )
});

// Create SQL logger
export const sqlLogger = winston.createLogger({
  level: 'info',
  transports: [sqlTransport],
  silent: false
});

// Application Logger configuration
const appTransport = new DailyRotateFile({
  filename: path.join(logsDir, 'app-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d', // Keep app logs for 2 weeks
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  )
});

// Create application logger
export const appLogger = winston.createLogger({
  level: 'info',
  transports: [
    appTransport,
    // Also log to console in development
    ...(process.env.NODE_ENV !== 'production' ? [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        )
      })
    ] : [])
  ]
});

// SQL logging function for Sequelize
export const logSQL = (sql: string) => {
  sqlLogger.info(sql);
};

export default { sqlLogger, appLogger, logSQL };
