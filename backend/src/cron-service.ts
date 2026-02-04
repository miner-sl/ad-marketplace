/**
 * Cron Service - Separate service for running scheduled jobs
 * This service runs independently from the main API server
 */
import * as dotenv from 'dotenv';
import { CronJobsSchedulerService } from './cron/jobs-scheduler.service';
import logger from './utils/logger';
import env from './utils/env';
import db from './db/connection';

dotenv.config();

let shutdownInProgress = false;

async function startCronService() {
  try {
    logger.info('Starting Cron Service...', {
      environment: env.NODE_ENV,
      nodeVersion: process.version,
    });

    await db.query('SELECT 1');
    logger.info('Database connection established');

    logger.info('Telegram bot initialized for notifications');

    CronJobsSchedulerService.startAll();
    logger.info('Cron service started successfully');

    logger.info('Cron service is running. Press Ctrl+C to stop.');
  } catch (error: any) {
    logger.error('Failed to start cron service', {
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  }
}

async function gracefulShutdown(signal: string) {
  if (shutdownInProgress) {
    logger.warn('Shutdown already in progress, forcing exit');
    process.exit(1);
  }

  shutdownInProgress = true;
  logger.info(`Received ${signal}, starting graceful shutdown...`);

  try {
    CronJobs.stopAll();
    logger.info('Cron jobs stopped');
  } catch (error: any) {
    logger.error('Error stopping cron jobs', { error: error.message });
  }

  try {
    await db.pool.end();
    logger.info('Database connections closed');
  } catch (error: any) {
    logger.error('Error closing database connections', { error: error.message });
  }

  logger.info('Cron service shutdown completed');
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

startCronService();
