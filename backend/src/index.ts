import cluster from 'cluster';
import os from 'os';

import bot from './bot';
import { CronJobsSchedulerService } from './cron/cron-scheduler.service';
import logger from './utils/logger';
import env from './utils/env';
import db from './db/connection';
import { closeRedis } from './utils/redis';
import { getWorkerId, isPrimaryWorker } from "./utils/cluster.util";
import { topicsService } from './services/topics.service';
import { buildApp } from './app';

const PORT = env.PORT;
const isProd = env.NODE_ENV === 'production';

function runTgBot() {
  if (!isPrimaryWorker()) {
    const workerId = getWorkerId();
    logger.info(
      `Worker ${String(workerId)}: Skipping Telegram setup (handled by primary worker)`,
    );
    return;
  }

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
  try {
    await topicsService.initialize();
    logger.info('Topics service initialized successfully');
  } catch (error: any) {
    logger.error('Failed to initialize topics service', {
      error: error.message,
      stack: error.stack,
    });
    // Don't fail startup if topics fail to load, but log the error
  }

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
        CronJobsSchedulerService.startAll();
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

    try {
      await closeRedis();
      logger.info('Redis connection closed');
    } catch (error: any) {
      logger.error('Error closing Redis connection', { error: error.message });
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
