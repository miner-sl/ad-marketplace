// @ts-ignore - bullmq types will be available after npm install
import { Queue, Worker } from 'bullmq';
import getRedisClient from '../utils/redis';
import { bot as telegramBot } from './telegram.service';
import logger from '../utils/logger';
import { isPrimaryWorker, getWorkerId } from '../utils/cluster.util';

export interface TelegramNotificationJob {
  telegramId: number;
  message: string;
  options?: {
    parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
    reply_markup?: any;
  };
}

/**
 * Service responsible for queuing and processing Telegram notifications
 * Uses BullMQ for reliable message delivery with rate limiting
 */
export class TelegramNotificationQueueService {
  private static readonly RATE_LIMIT = 25; // Telegram rate limit: ~30 messages/second to different users
  private static readonly QUEUE_NAME = 'telegram-notifications';
  private static readonly CONCURRENCY = 10;

  private static instance: TelegramNotificationQueueService | null = null;
  private notificationQueue: Queue<TelegramNotificationJob> | null = null;
  private worker: Worker<TelegramNotificationJob> | null = null;
  private readonly logger = logger;

  /**
   * Get singleton instance
   */
  static getInstance(): TelegramNotificationQueueService {
    if (!TelegramNotificationQueueService.instance) {
      TelegramNotificationQueueService.instance = new TelegramNotificationQueueService();
    }
    return TelegramNotificationQueueService.instance;
  }

  /**
   * Queue a Telegram message to be sent (static convenience method)
   */
  static async queueTelegramMessage(
    telegramId: number,
    message: string,
    options?: {
      parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
      reply_markup?: any;
    }
  ): Promise<void> {
    const instance = TelegramNotificationQueueService.getInstance();
    return instance.queueTelegramMessage(telegramId, message, options);
  }

  /**
   * Initialize the queue and worker
   * Queue can be created on all workers (needed for adding jobs)
   * Worker only runs on primary worker to avoid duplicate processing
   */
  onModuleInit(): void {
    const queueConnection = getRedisClient().duplicate({
      maxRetriesPerRequest: null,
    });

    // Queue can be created on all workers (needed for adding jobs)
    this.notificationQueue = new Queue<TelegramNotificationJob>(
      TelegramNotificationQueueService.QUEUE_NAME,
      {
        connection: queueConnection,
        defaultJobOptions: {
          removeOnComplete: true,
          removeOnFail: 100,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
        },
      }
    );

    if (!isPrimaryWorker()) {
      const workerId = getWorkerId();
      this.logger.info(
        `Worker ${String(workerId)}: Telegram notification queue initialized (processing handled by primary worker)`
      );
      return;
    }

    // Worker only runs on primary worker
    const workerConnection = getRedisClient().duplicate({
      maxRetriesPerRequest: null,
    });

    this.worker = new Worker<TelegramNotificationJob>(
      TelegramNotificationQueueService.QUEUE_NAME,
      async (job: { data: TelegramNotificationJob; id?: string }) => {
        await this.processNotification(job.data);
      },
      {
        connection: workerConnection,
        concurrency: TelegramNotificationQueueService.CONCURRENCY,
        limiter: {
          max: TelegramNotificationQueueService.RATE_LIMIT,
          duration: 1000,
        },
      }
    );

    this.worker.on('completed', (job: { id?: string; data: TelegramNotificationJob }) => {
      this.logger.debug(`Notification job ${String(job.id)} completed`, {
        telegramId: job.data.telegramId,
      });
    });

    this.worker.on('failed', (job: any, err: Error) => {
      this.logger.warn(`Notification job ${String(job?.id)} failed`, {
        telegramId: job?.data.telegramId,
        error: err.message,
        stack: err.stack,
      });
    });

    this.worker.on('error', (err: Error) => {
      this.logger.error('Telegram notification worker error', {
        error: err.message,
        stack: err.stack,
      });
    });

    const workerId = getWorkerId();
    this.logger.info(
      `Worker ${String(workerId ?? 'single')}: Telegram notification queue initialized (${String(TelegramNotificationQueueService.RATE_LIMIT)}/sec rate limit, Redis-backed)`
    );
  }

  /**
   * Queue a Telegram message to be sent
   * @param telegramId - Telegram user ID
   * @param message - Message text
   * @param options - Optional message options (parse_mode, reply_markup, etc.)
   */
  async queueTelegramMessage(
    telegramId: number,
    message: string,
    options?: {
      parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
      reply_markup?: any;
    }
  ): Promise<void> {
    if (!this.notificationQueue) {
      throw new Error('Notification queue not initialized. Call onModuleInit() first.');
    }

    await this.notificationQueue.add(
      'send',
      { telegramId, message, options },
      { priority: 1 }
    );

    this.logger.debug(`Queued Telegram message for user ${String(telegramId)}`);
  }

  /**
   * Process a notification job by sending it to Telegram
   * @private
   */
  private async processNotification(data: TelegramNotificationJob): Promise<void> {
    try {
      await telegramBot.sendMessage(
        data.telegramId,
        data.message,
        data.options || {}
      );

      this.logger.debug(`Sent notification to Telegram user ${String(data.telegramId)}`);
    } catch (error: any) {
      this.logger.warn(
        `Failed to send Telegram notification to ${String(data.telegramId)}`,
        {
          error: error.message,
          stack: error.stack,
        }
      );
      throw error; // Re-throw to trigger retry
    }
  }

  /**
   * Close the queue and worker connections
   */
  async close(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
      this.logger.info('Telegram notification worker closed');
    }

    if (this.notificationQueue) {
      await this.notificationQueue.close();
      this.notificationQueue = null;
      this.logger.info('Telegram notification queue closed');
    }
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  }> {
    if (!this.notificationQueue) {
      return { waiting: 0, active: 0, completed: 0, failed: 0 };
    }

    const [waiting, active, completed, failed] = await Promise.all([
      this.notificationQueue.getWaitingCount(),
      this.notificationQueue.getActiveCount(),
      this.notificationQueue.getCompletedCount(),
      this.notificationQueue.getFailedCount(),
    ]);

    return { waiting, active, completed, failed };
  }
}
