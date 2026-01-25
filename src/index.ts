import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import * as path from 'path';
import channelsRouter from './routes/channels';
import dealsRouter from './routes/deals';
import campaignsRouter from './routes/campaigns';
import bot from './bot';
import { CronJobs } from './cron/jobs';
import logger from './utils/logger';
import env from './utils/env';
import { requestIdMiddleware } from './middleware/requestId';
import db from './db/connection';

const app = express();
const PORT = env.PORT;

// Middleware
app.use(requestIdMiddleware);
app.use(helmet({
  contentSecurityPolicy: env.NODE_ENV === 'production' ? undefined : false,
}));
app.use(cors({
  origin: env.NODE_ENV === 'production' 
    ? process.env.ALLOWED_ORIGINS?.split(',') || false
    : true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  logger.debug('Incoming request', {
    method: req.method,
    path: req.path,
    requestId: req.requestId,
    ip: req.ip,
  });
  next();
});

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: env.NODE_ENV === 'production' ? 100 : 1000, // More lenient in dev
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Health check endpoints
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    requestId: req.requestId,
  });
});

// Readiness check (checks database connection)
app.get('/ready', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ 
      status: 'ready', 
      timestamp: new Date().toISOString(),
      database: 'connected',
      requestId: req.requestId,
    });
  } catch (error: any) {
    logger.error('Readiness check failed', { error: error.message, requestId: req.requestId });
    res.status(503).json({ 
      status: 'not ready', 
      database: 'disconnected',
      requestId: req.requestId,
    });
  }
});

// Liveness check
app.get('/live', (req, res) => {
  res.json({ 
    status: 'alive', 
    timestamp: new Date().toISOString(),
    requestId: req.requestId,
  });
});

// Swagger documentation
const swaggerDocument = YAML.load(path.join(__dirname, '../swagger.yaml'));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// API routes
app.use('/api/channels', channelsRouter);
app.use('/api/deals', dealsRouter);
app.use('/api/campaigns', campaignsRouter);

// Webhook for Telegram bot
app.post('/webhook', async (req, res) => {
  try {
    await bot.handleUpdate(req.body);
    res.sendStatus(200);
  } catch (error: any) {
    logger.error('Webhook error', { 
      error: error.message, 
      stack: error.stack,
      requestId: req.requestId,
    });
    res.status(500).json({ 
      error: 'Webhook processing failed',
      requestId: req.requestId,
    });
  }
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal server error';
  
  logger.error('Request error', {
    error: message,
    stack: err.stack,
    status,
    method: req.method,
    path: req.path,
    requestId: req.requestId,
  });
  
  res.status(status).json({
    error: env.NODE_ENV === 'production' && status === 500 
      ? 'Internal server error' 
      : message,
    requestId: req.requestId,
    ...(env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
});

// Start server
const server = app.listen(PORT, () => {
  logger.info('Server started', {
    port: PORT,
    environment: env.NODE_ENV,
    nodeVersion: process.version,
  });
  
  // Start cron jobs
  try {
    CronJobs.startAll();
    logger.info('Cron jobs started');
  } catch (error: any) {
    logger.error('Failed to start cron jobs', { error: error.message });
  }

  // Launch bot
  if (env.NODE_ENV === 'production' && env.TELEGRAM_WEBHOOK_URL) {
    bot.telegram.setWebhook(env.TELEGRAM_WEBHOOK_URL)
      .then(() => {
        logger.info('Telegram webhook set successfully', { url: env.TELEGRAM_WEBHOOK_URL });
      })
      .catch((error: any) => {
        logger.error('Failed to set webhook', { error: error.message });
      });
  } else {
    // Use polling in development
    bot.launch()
      .then(() => {
        logger.info('Bot started with polling');
      })
      .catch((error: any) => {
        logger.error('Failed to start bot', { error: error.message });
      });
  }
});

// Graceful shutdown
let shutdownInProgress = false;

async function gracefulShutdown(signal: string) {
  if (shutdownInProgress) {
    logger.warn('Shutdown already in progress, forcing exit');
    process.exit(1);
  }
  
  shutdownInProgress = true;
  logger.info(`Received ${signal}, starting graceful shutdown...`);

  // Stop accepting new connections
  server.close(() => {
    logger.info('HTTP server closed');
  });

  // Stop bot
  try {
    await bot.stop(signal);
    logger.info('Bot stopped');
  } catch (error: any) {
    logger.error('Error stopping bot', { error: error.message });
  }

  // Stop cron jobs
  try {
    CronJobs.stopAll();
    logger.info('Cron jobs stopped');
  } catch (error: any) {
    logger.error('Error stopping cron jobs', { error: error.message });
  }

  // Close database connections
  try {
    await db.pool.end();
    logger.info('Database connections closed');
  } catch (error: any) {
    logger.error('Error closing database connections', { error: error.message });
  }

  logger.info('Graceful shutdown completed');
  process.exit(0);
}

process.once('SIGINT', () => gracefulShutdown('SIGINT'));
process.once('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught exception', { error: error.message, stack: error.stack });
  gracefulShutdown('uncaughtException');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  logger.error('Unhandled promise rejection', { 
    reason: reason?.message || reason,
    stack: reason?.stack,
  });
  gracefulShutdown('unhandledRejection');
});
