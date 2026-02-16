import * as cron from 'node-cron';
import logger from '../utils/logger';
import db from '../db/connection';
import { TelegramChannelStatsRefreshSenderService } from './telegram-channel-stats-refresh-sender.service';
import { isPrimaryWorker } from '../utils/cluster.util';

/**
 * Service responsible for scheduling and processing Telegram channel stats refresh
 * Runs on a cron schedule to batch refresh statistics for active channels
 */
export class TelegramChannelStatsRefreshSchedulerService {
  private readonly logger = logger;
  private isProcessing = false;
  private job: cron.ScheduledTask | null = null;

  /**
   * Initialize the scheduler service
   */
  onModuleInit(): void {
    this.logger.info('TelegramChannelStatsRefreshSchedulerService initialized');
  }

  /**
   * Start the channel stats refresh job
   * Runs daily at 2 AM to refresh statistics for all active channels
   */
  start(): void {
    if (!isPrimaryWorker()) {
      this.logger.info('TelegramChannelStatsRefreshSchedulerService: Skipping start (not primary worker)');
      return;
    }

    if (this.job) {
      this.logger.warn('TelegramChannelStatsRefreshSchedulerService: Job already started');
      return;
    }
    // void this.processStatsRefresh();
    // Run daily at 2 AM
    this.job = cron.schedule('0 2 * * *', async () => {
      await this.processStatsRefresh();
    });

    this.logger.info('TelegramChannelStatsRefreshSchedulerService: Channel stats refresh job started (runs daily at 2 AM)');
  }

  /**
   * Stop the channel stats refresh job
   */
  stop(): void {
    if (this.job) {
      this.job.stop();
      this.job = null;
      this.logger.info('TelegramChannelStatsRefreshSchedulerService: Channel stats refresh job stopped');
    }
  }

  /**
   * Process stats refresh for all active channels
   * Uses a flag to prevent concurrent processing
   */
  private async processStatsRefresh(): Promise<void> {
    if (this.isProcessing) {
      this.logger.debug('TelegramChannelStatsRefreshSchedulerService: Already processing, skipping');
      return;
    }

    this.isProcessing = true;

    try {
      this.logger.info('Refreshing channel stats...');

      const channelsResult = await db.query(
        'SELECT id, telegram_channel_id, username FROM channels WHERE is_active = TRUE'
      );

      const channels = channelsResult?.rows || [];

      if (channels.length === 0) {
        return;
      }

      this.logger.info(`Processing ${channels.length} channels for stats refresh`);

      const statsRefreshSenderService = new TelegramChannelStatsRefreshSenderService();

      for (const channel of channels) {
        try {
          const result = await statsRefreshSenderService.refreshChannelStats(
            channel.id,
            channel.telegram_channel_id,
            channel.username
          );

          if (result.success) {
            this.logger.info(`Successfully refreshed stats for Channel #${channel.id}`, {
              channelId: channel.id,
            });
          } else {
            this.logger.error(`Failed to refresh stats for Channel #${channel.id}`, {
              channelId: channel.id,
              error: result.error,
            });
          }
        } catch (error: any) {
          this.logger.error(`Error processing stats refresh for Channel #${channel.id}`, {
            channelId: channel.id,
            error: error.message,
            stack: error.stack,
          });
        }
      }

      this.logger.info(`Processed ${channels.length} channel stats refreshes`);
    } catch (error: any) {
      this.logger.error('Error processing channel stats refresh', {
        error: error.message,
        stack: error.stack,
      });
    } finally {
      this.isProcessing = false;
    }
  }
}
