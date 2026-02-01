import winston from 'winston';
import * as path from 'path';

const logDir = process.env.LOG_DIR || 'logs';

const enableConsoleLogging = process.env.ENABLE_CONSOLE_LOGGING === '1';

let logger: any;

if (enableConsoleLogging) {
  // Simple console.log wrapper when enableConsoleLogging is true - no winston
  const getTimestamp = () => {
    return new Date().toISOString().replace('T', ' ').substring(0, 19);
  };

  const formatMessage = (level: string, message: string, ...meta: any[]) => {
    const timestamp = getTimestamp();
    const metaStr = meta.length > 0 ? ' ' + JSON.stringify(meta) : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
  };

  logger = {
    error: (message: string, ...meta: any[]) => {
      console.log(formatMessage('error', message, ...meta));
    },
    warn: (message: string, ...meta: any[]) => {
      console.log(formatMessage('warn', message, ...meta));
    },
    info: (message: string, ...meta: any[]) => {
      console.log(formatMessage('info', message, ...meta));
    },
    debug: (message: string, ...meta: any[]) => {
      console.log(formatMessage('debug', message, ...meta));
    },
    verbose: (message: string, ...meta: any[]) => {
      console.log(formatMessage('verbose', message, ...meta));
    },
    silly: (message: string, ...meta: any[]) => {
      console.log(formatMessage('silly', message, ...meta));
    },
  };
} else {
  // Use winston for file logging when console logging is disabled
  logger = winston.createLogger({
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

  // Console transport for non-production environments
  if (process.env.NODE_ENV === 'production') {
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
}

export default logger;
