import winston from 'winston';
import * as path from 'path';

const logDir = process.env.LOG_DIR || 'logs';

const enableConsoleLogging = process.env.ENABLE_CONSOLE_LOGGING === '1';
// Ensure log directory exists (in production, create it before starting)
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { 
    service: 'ad-marketplace',
    env: process.env.NODE_ENV || 'development'
  },
  transports: [
    // Error log file
    new winston.transports.File({ 
      filename: path.join(logDir, 'error.log'), 
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Combined log file
    new winston.transports.File({ 
      filename: path.join(logDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
  // Handle uncaught exceptions
  exceptionHandlers: [
    new winston.transports.File({ filename: path.join(logDir, 'exceptions.log') })
  ],
  // Handle unhandled promise rejections
  rejectionHandlers: [
    new winston.transports.File({ filename: path.join(logDir, 'rejections.log') })
  ],
});

// Console transport for all environments (but with different formats)
if (enableConsoleLogging) {
  // If console logging is enabled, add a custom transport that uses console.log
  logger.add(
    new winston.transports.Console({
      format: winston.format.printf((info) => {
        const { level, message, timestamp, ...meta } = info;
        const metaStr = Object.keys(meta).length > 0 ? ' ' + JSON.stringify(meta) : '';
        const logMessage = `[${level.toUpperCase()}] ${message}${metaStr}`;
        
        // Use appropriate console method based on level
        if (level === 'error') {
          console.error(logMessage);
        } else if (level === 'warn') {
          console.warn(logMessage);
        } else {
          console.log(logMessage);
        }
        
        return logMessage;
      }),
    })
  );
} else if (process.env.NODE_ENV === 'production') {
  // In production, use JSON format for better log aggregation
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
    })
  );
} else {
  // In development, use colored simple format
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
          return `${timestamp} [${level}]: ${message} ${metaStr}`;
        })
      ),
    })
  );
}

export default logger;
