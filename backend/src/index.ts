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
import userRouter from './routes/user';
import bot from './bot';
import { CronJobs } from './cron/jobs';
import logger from './utils/logger';
import env from './utils/env';
import { requestIdMiddleware } from './middleware/requestId';
import db from './db/connection';

const app = express();
const PORT = env.PORT;
const isProd = env.NODE_ENV === 'production';

app.use(requestIdMiddleware);
app.use(helmet({
  contentSecurityPolicy: isProd ? undefined : false,
}));
app.use(cors({
  origin: isProd
    ? process.env.ALLOWED_ORIGINS?.split(',') || false
    : true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use((req, res, next) => {
  logger.debug('Incoming request', {
    method: req.method,
    path: req.path,
    requestId: req.requestId,
    ip: req.ip,
  });
  next();
});

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isProd ? 100 : 1000, // More lenient in dev
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

const swaggerDocument = YAML.load(path.join(__dirname, '../swagger.yaml'));
app.use('/api-docs', swaggerUi.serve as any, swaggerUi.setup(swaggerDocument) as any);

// API routes
app.use('/api/channels', channelsRouter);
app.use('/api/deals', dealsRouter);
app.use('/api/campaigns', campaignsRouter);
app.use('/api/user', userRouter);

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

app.use((err: any, req: express.Request, res: express.Response) => {
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
    error: isProd && status === 500
      ? 'Internal server error'
      : message,
    requestId: req.requestId,
    ...(env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
});

function runTgBot() {
  if (isProd && env.TELEGRAM_WEBHOOK_URL) {
    bot.telegram.setWebhook(env.TELEGRAM_WEBHOOK_URL)
      .then(() => {
        logger.info('Telegram webhook set successfully', {url: env.TELEGRAM_WEBHOOK_URL});
      })
      .catch((error: any) => {
        logger.error('Failed to set webhook', {error: error.message});
      });
  } else {
    // Use polling in development
    bot.launch()
      .then(() => {
        logger.info('Bot started with polling');
      })
      .catch((error: any) => {
        logger.error('Failed to start bot', {error: error.message});
      });
  }
}

const server = app.listen(PORT, () => {
  logger.info('Server started', {
    port: PORT,
    environment: env.NODE_ENV,
    nodeVersion: process.version,
  });

  if (!isProd) {
    try {
      CronJobs.startAll();
      logger.info('Cron jobs started');
    } catch (error: any) {
      logger.error('Failed to start cron jobs', { error: error.message });
    }
  }
  runTgBot();
});

let shutdownInProgress = false;

async function gracefulShutdown(signal: string) {
  if (shutdownInProgress) {
    logger.warn('Shutdown already in progress, forcing exit');
    process.exit(1);
  }

  shutdownInProgress = true;
  logger.info(`Received ${signal}, starting graceful shutdown...`);

  server.close(() => {
    logger.info('HTTP server closed');
  });

  try {
    await bot.stop(signal);
    logger.info('Bot stopped');
  } catch (error: any) {
    logger.error('Error stopping bot', { error: error.message });
  }

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

process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught exception', { error: error.message, stack: error.stack });
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason: any) => {
  logger.error('Unhandled promise rejection', {
    reason: reason?.message || reason,
    stack: reason?.stack,
  });
  gracefulShutdown('unhandledRejection');
});
