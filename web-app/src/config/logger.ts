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

// Session Logger configuration
const sessionTransport = new DailyRotateFile({
  filename: path.join(logsDir, 'session-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '30d', // Keep session logs for 30 days
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  )
});

// Create session logger
export const sessionLogger = winston.createLogger({
  level: 'info',
  transports: [sessionTransport],
  silent: false
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

// Session logging function with enhanced metadata
export const logSession = (eventType: string, req: any, additionalData: any = {}) => {
  const sessionData = {
    eventType,
    sessionId: req.sessionID || req.session?.id || 'unknown',
    userId: req.user?.id || null,
    userAgent: req.headers['user-agent'] || null,
    ipAddress: req.headers['x-forwarded-for'] || 
               req.headers['x-real-ip'] || 
               req.connection?.remoteAddress || 
               req.socket?.remoteAddress || 
               req.ip || 
               null,
    referer: req.headers['referer'] || req.headers['referrer'] || null,
    acceptLanguage: req.headers['accept-language'] || null,
    acceptEncoding: req.headers['accept-encoding'] || null,
    host: req.headers['host'] || null,
    protocol: req.protocol || null,
    method: req.method || null,
    url: req.originalUrl || req.url || null,
    cookies: Object.keys(req.cookies || {}).length > 0 ? Object.keys(req.cookies) : null,
    secure: req.secure || false,
    xhr: req.xhr || false,
    timestamp: new Date().toISOString(),
    ...additionalData
  };
  
  sessionLogger.info(sessionData);
};

export default { sqlLogger, appLogger, sessionLogger, logSQL, logSession };
