import Fastify from 'fastify';
import cluster from 'cluster';
import os from 'os';
import * as path from 'path';
import YAML from 'yamljs';

import channelsRouter from './routes/channels';
import dealsRouter from './routes/deals';
import campaignsRouter from './routes/campaigns';
import userRouter from './routes/user';
import bot from './bot';
import { CronJobs } from './cron/jobs';
import logger from './utils/logger';
import env from './utils/env';
import { requestIdPlugin } from './middleware/requestId';
import db from './db/connection';

const PORT = env.PORT;
const isProd = env.NODE_ENV === 'production';

async function buildApp() {
  const app = Fastify({
    logger: false, // We use winston for logging
    requestIdLogLabel: 'requestId',
    requestIdHeader: 'X-Request-ID',
    bodyLimit: 10 * 1024 * 1024, // 10MB
  });

  // Register request ID plugin
  await app.register(requestIdPlugin);

  // Register CORS
  await app.register(require('@fastify/cors'), {
    origin: isProd
      ? process.env.ALLOWED_ORIGINS?.split(',') || false
      : true,
  });

  // Register Helmet for security
  await app.register(require('@fastify/helmet'), {
    contentSecurityPolicy: isProd ? undefined : false,
  });

  // Rate limiting will be registered for /api routes only

  // Request logging hook
  app.addHook('onRequest', async (request, reply) => {
    logger.debug('Incoming request', {
      method: request.method,
      path: request.url,
      requestId: request.requestId,
      ip: request.ip,
    });
  });

  // Health check endpoints
  app.get('/health', async (request, reply) => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      requestId: request.requestId,
    };
  });

  app.get('/ready', async (request, reply) => {
    try {
      await db.query('SELECT 1');
      return {
        status: 'ready',
        timestamp: new Date().toISOString(),
        database: 'connected',
        requestId: request.requestId,
      };
    } catch (error: any) {
      logger.error('Readiness check failed', { error: error.message, requestId: request.requestId });
      reply.code(503);
      return {
        status: 'not ready',
        database: 'disconnected',
        requestId: request.requestId,
      };
    }
  });

  // Liveness check
  app.get('/live', async (request, reply) => {
    return {
      status: 'alive',
      timestamp: new Date().toISOString(),
      requestId: request.requestId,
    };
  });

  // Swagger documentation
  const swaggerDocument = YAML.load(path.join(__dirname, '../swagger.yaml')) as any;
  await app.register(require('@fastify/swagger'), {
    openapi: {
      openapi: swaggerDocument.openapi || '3.0.0',
      info: swaggerDocument.info,
      servers: swaggerDocument.servers,
      paths: swaggerDocument.paths,
      components: swaggerDocument.components,
    },
  });
  
  await app.register(require('@fastify/swagger-ui'), {
    routePrefix: '/api-docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false,
    },
    staticCSP: true,
    transformStaticCSP: (header: any) => header,
  });

  // API routes with rate limiting
  await app.register(async function (fastify) {
    // Register rate limiting for all routes in this scope (/api)
    await fastify.register(require('@fastify/rate-limit'), {
      max: isProd ? 100 : 1000,
      timeWindow: '15 minutes',
      addHeaders: {
        'x-ratelimit-limit': true,
        'x-ratelimit-remaining': true,
        'x-ratelimit-reset': true,
      },
    });

    // Register route handlers
    await fastify.register(channelsRouter, { prefix: '/channels' });
    await fastify.register(dealsRouter, { prefix: '/deals' });
    await fastify.register(campaignsRouter, { prefix: '/campaigns' });
    await fastify.register(userRouter, { prefix: '/user' });
  }, { prefix: '/api' });

  // Webhook for Telegram bot
  app.post('/webhook', async (request, reply) => {
    try {
      await bot.handleUpdate(request.body as any);
      reply.code(200).send();
    } catch (error: any) {
      logger.error('Webhook error', {
        error: error.message,
        stack: error.stack,
        requestId: request.requestId,
      });
      reply.code(500).send({
        error: 'Webhook processing failed',
        requestId: request.requestId,
      });
    }
  });

  // Error handler
  app.setErrorHandler((error, request, reply) => {
    const status = error.statusCode || 500;
    const message = error.message || 'Internal server error';

    logger.error('Request error', {
      error: message,
      stack: error.stack,
      status,
      method: request.method,
      path: request.url,
      requestId: request.requestId,
    });

    reply.status(status).send({
      error: isProd && status === 500
        ? 'Internal server error'
        : message,
      requestId: request.requestId,
      ...(env.NODE_ENV !== 'production' && { stack: error.stack }),
    });
  });

  return app;
}

function runTgBot() {
  const workerId = cluster.worker?.id || 0;
  
  if (isProd && env.TELEGRAM_WEBHOOK_URL) {
    // In production with webhooks, only worker 0 sets the webhook URL
    // All workers can handle webhook requests
    if (workerId === 0) {
      bot.telegram.setWebhook(env.TELEGRAM_WEBHOOK_URL)
        .then(() => {
          logger.info('Telegram webhook set successfully', {url: env.TELEGRAM_WEBHOOK_URL});
        })
        .catch((error: any) => {
          logger.error('Failed to set webhook', {error: error.message});
        });
    }
  } else {
    // In development with polling, only worker 0 should start the bot
    // to prevent multiple instances polling simultaneously
    if (workerId === 0) {
      bot.launch()
        .then(() => {
          logger.info('Bot started with polling');
        })
        .catch((error: any) => {
          logger.error('Failed to start bot', {error: error.message});
        });
    } else {
      logger.info('Bot polling skipped in worker (only worker 0 handles polling)', {
        workerId,
      });
    }
  }
}

async function bootstrap(): Promise<void> {
  const app = await buildApp();

  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    logger.info('Server started', {
      port: PORT,
      environment: env.NODE_ENV,
      nodeVersion: process.version,
      workerId: cluster.worker?.id,
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
  } catch (error: any) {
    logger.error('Failed to start server', { error: error.message, stack: error.stack });
    process.exit(1);
  }

  let shutdownInProgress = false;

  async function gracefulShutdown(signal: string) {
    if (shutdownInProgress) {
      logger.warn('Shutdown already in progress, forcing exit');
      process.exit(1);
    }

    shutdownInProgress = true;
    logger.info(`Received ${signal}, starting graceful shutdown...`);

    try {
      await app.close();
      logger.info('HTTP server closed');
    } catch (error: any) {
      logger.error('Error closing server', { error: error.message });
    }

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
}

function startCluster(): void {
  const clusterWorkersEnv = process.env.CLUSTER_WORKERS ?? "0";

  // Support "auto" to use all available CPU cores
  let numWorkers: number;
  if (clusterWorkersEnv.toLowerCase() === "auto") {
    numWorkers = os.cpus().length;
    logger.info(
      `CLUSTER_WORKERS=auto, detected ${String(numWorkers)} CPU cores`,
    );
  } else {
    numWorkers = parseInt(clusterWorkersEnv, 10);
  }

  // If CLUSTER_WORKERS=0 or not set, run in single-process mode
  if (numWorkers <= 0) {
    logger.info("Running in single-process mode");
    void bootstrap();
    return;
  }

  const actualWorkers = Math.min(numWorkers, os.cpus().length);

  if (cluster.isPrimary) {
    logger.info(
      `Primary ${String(process.pid)} starting ${String(actualWorkers)} workers...`,
    );

    // Fork workers - each will listen on the same port (OS handles load balancing)
    for (let i = 0; i < actualWorkers; i++) {
      cluster.fork();
    }

    // Handle worker exit with automatic restart
    cluster.on("exit", (worker, code, signal) => {
      const reason = signal !== "" ? signal : String(code);
      logger.warn(
        `Worker ${String(worker.process.pid)} died (${reason}). Restarting...`,
      );
      cluster.fork();
    });

    // Handle worker online
    cluster.on("online", (worker) => {
      logger.info(
        `Worker ${String(worker.process.pid)} (id: ${String(worker.id)}) is online`,
      );
    });
  } else {
    // Workers run the application - they receive connections via IPC from master
    logger.info(
      `Worker ${String(process.pid)} (id: ${String(cluster.worker?.id)}) starting...`,
    );
    void bootstrap();
  }
}

startCluster();
