import * as cron from 'node-cron';

import { TelegramService } from '../services/telegram.service';
import { PostSchedulerService } from '../services/post-scheduler.service';
import { AutoReleaseSchedulerService } from '../services/auto-release-scheduler.service';
import { VerificationSchedulerService } from '../services/verification-scheduler.service';
import { TonEscrowPaymentPollingService } from '../services/ton-escrow-payment-polling.service';

import { DealModel } from '../repositories/deal-model.repository';
import { ChannelModel } from '../repositories/channel-model.repository';
import { UserModel } from '../repositories/user.repository';

import db from '../db/connection';
import logger from '../utils/logger';
import { isPrimaryWorker } from '../utils/cluster.util';

export class CronJobsSchedulerService {
  private static jobs: cron.ScheduledTask[] = [];
  private static postSchedulerService: PostSchedulerService | null = null;
  private static autoReleaseSchedulerService: AutoReleaseSchedulerService | null = null;
  private static verificationSchedulerService: VerificationSchedulerService | null = null;
  private static tonEscrowPaymentPollingService: TonEscrowPaymentPollingService | null = null;

  /**
   * Start all cron jobs
   */
  static startAll() {
    if (!isPrimaryWorker()) {
      return;
    }
    logger.info('Starting cron jobs...');

    this.postSchedulerService = new PostSchedulerService();
    this.postSchedulerService.onModuleInit();
    this.postSchedulerService.start();

    this.autoReleaseSchedulerService = new AutoReleaseSchedulerService();
    this.autoReleaseSchedulerService.onModuleInit();
    this.autoReleaseSchedulerService.start();

    this.verificationSchedulerService = new VerificationSchedulerService();
    this.verificationSchedulerService.onModuleInit();
    this.verificationSchedulerService.start();

    this.tonEscrowPaymentPollingService = new TonEscrowPaymentPollingService();
    this.tonEscrowPaymentPollingService.onModuleInit();
    this.tonEscrowPaymentPollingService.start();

    // TODO maybe need to merge some jobs into one
    // TODO scalable jobs

    // Check for expired deals every 10 minutes
    // this.startExpiredDealsJob();

    // Refresh channel stats daily at 2 AM
    this.startTelegramChannelStatsRefreshJob();

    logger.info(`Started ${this.jobs.length} cron job(s) + PostSchedulerService + AutoReleaseSchedulerService + VerificationSchedulerService + TonEscrowPaymentPollingService`);
  }

  /**
   * Stop all cron jobs
   */
  static stopAll() {
    this.jobs.forEach(job => job.stop());
    this.jobs = [];

    if (this.postSchedulerService) {
      this.postSchedulerService.stop();
      this.postSchedulerService = null;
    }

    if (this.autoReleaseSchedulerService) {
      this.autoReleaseSchedulerService.stop();
      this.autoReleaseSchedulerService = null;
    }

    if (this.verificationSchedulerService) {
      this.verificationSchedulerService.stop();
      this.verificationSchedulerService = null;
    }

    if (this.tonEscrowPaymentPollingService) {
      this.tonEscrowPaymentPollingService.stop();
      this.tonEscrowPaymentPollingService = null;
    }

    logger.info('Stopped all cron jobs');
  }

  /**
   * Cancel expired deals
   * Runs every 10 minutes
   */
  private static startExpiredDealsJob() {
    const job = cron.schedule('*/10 * * * *', async () => {
      try {
        logger.debug('Checking for expired deals...');

        const expiredDeals = await DealModel.findExpiredDeals();

        if (expiredDeals.length === 0) {
          return;
        }

        const userIds = new Set<number>();
        expiredDeals.forEach((deal: any) => {
          userIds.add(deal.advertiser_id);
          userIds.add(deal.channel_owner_id);
        });
        const usersMap = await UserModel.findByIds(Array.from(userIds));

        for (const deal of expiredDeals) {
          try {
            await DealModel.cancel(deal.id, 'Deal expired (timeout)');

            logger.info(`Cancelled expired Deal #${deal.id}`, { dealId: deal.id });

            const advertiser = usersMap.get(deal.advertiser_id);
            const channelOwner = usersMap.get(deal.channel_owner_id);

            if (advertiser) {
              await TelegramService.bot.sendMessage(
                advertiser.telegram_id,
                `⏰ Deal #${deal.id} has expired and been cancelled.\n\n` +
                `Reason: Timeout (no activity for 72 hours)\n\n` +
                `Use /deal ${deal.id} to view details.`
              ).catch((err: any) => {
                logger.warn(`Failed to notify advertiser for Deal #${deal.id}`, { dealId: deal.id, error: err.message });
              });
            }

            if (channelOwner) {
              await TelegramService.bot.sendMessage(
                channelOwner.telegram_id,
                `⏰ Deal #${deal.id} has expired and been cancelled.\n\n` +
                `Reason: Timeout (no activity for 72 hours)\n\n` +
                `Use /deal ${deal.id} to view details.`
              ).catch((err: any) => {
                logger.warn(`Failed to notify channel owner for Deal #${deal.id}`, { dealId: deal.id, error: err.message });
              });
            }
          } catch (error: any) {
            logger.error(`Error cancelling expired Deal #${deal.id}`, { dealId: deal.id, error: error.message, stack: error.stack });
          }
        }
      } catch (error: any) {
        logger.error('Error in expired deals job', { error: error.message, stack: error.stack });
      }
    });

    this.jobs.push(job);
    logger.info('Expired deals job started (runs every 10 minutes)');
  }


  /**
   * Refresh channel stats
   * Runs daily at 2 AM
   */
  private static startTelegramChannelStatsRefreshJob() {
    const job = cron.schedule('0 2 * * *', async () => {
      try {
        logger.info('Refreshing channel stats...');

        const channels = await db.query(
          'SELECT id, telegram_channel_id FROM channels WHERE is_active = TRUE'
        );

        for (const channel of channels.rows) {
          try {
            const stats = await TelegramService.fetchChannelStats(channel.telegram_channel_id);
            await ChannelModel.saveStats(channel.id, stats);

            logger.info(`Refreshed stats for Channel #${channel.id}`, { channelId: channel.id });
          } catch (error: any) {
            logger.error(`Error refreshing stats for Channel #${channel.id}`, { channelId: channel.id, error: error.message, stack: error.stack });
          }
        }
      } catch (error: any) {
        logger.error('Error in stats refresh job', { error: error.message, stack: error.stack });
      }
    });

    this.jobs.push(job);
    logger.info('Stats refresh job started (runs daily at 2 AM)');
  }
}
