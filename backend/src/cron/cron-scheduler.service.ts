import * as cron from 'node-cron';

import { TONService } from '../services/ton.service';
import { TelegramService } from '../services/telegram.service';
import { DealFlowService } from '../services/deal-flow.service';
import { PostSchedulerService } from '../services/post-scheduler.service';
import { AutoReleaseSchedulerService } from '../services/auto-release-scheduler.service';
import { VerificationSchedulerService } from '../services/verification-scheduler.service';

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

    // TODO maybe need to merge some jobs into one
    // TODO scalable jobs
    // Check for payments every 2 minutes
    this.startPaymentCheckJob();

    // Check for expired deals every 10 minutes
    // this.startExpiredDealsJob();

    // Refresh channel stats daily at 2 AM
    this.startStatsRefreshJob();

    logger.info(`Started ${this.jobs.length} cron job(s) + PostSchedulerService + AutoReleaseSchedulerService + VerificationSchedulerService`);
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

    logger.info('Stopped all cron jobs');
  }

  /**
   * Check for pending payments and update deal status
   * Runs every 2 minutes
   * Optimized: Batch fetches users to avoid N+1 queries
   */
  private static startPaymentCheckJob() {
    const job = cron.schedule('*/2 * * * *', async () => {
      try {
        logger.debug('Checking for pending payments...');

        const dealsResult = await db.query(
          `SELECT * FROM deals 
           WHERE status = 'payment_pending' 
           AND escrow_address IS NOT NULL
           AND payment_tx_hash IS NULL
           ORDER BY created_at ASC`
        );

        const deals = dealsResult?.rows || [];
        if (deals.length === 0) {
          return;
        }

        const userIds = new Set<number>();
        deals.forEach((deal: any) => {
          userIds.add(deal.advertiser_id);
          userIds.add(deal.channel_owner_id);
        });
        const usersMap = await UserModel.findByIds(Array.from(userIds));

        for (const deal of deals) {
          try {
            if (deal.payment_tx_hash && deal.status !== 'payment_pending') {
              logger.debug(`Deal #${deal.id} payment already confirmed, skipping`, {
                dealId: deal.id,
                existingTxHash: deal.payment_tx_hash,
                status: deal.status,
              });
              continue;
            }

            // Payment check is done outside transaction to avoid long-running locks
            const paymentCheck = await TONService.checkPayment(
              deal.escrow_address,
              deal.price_ton.toString()
            );

            if (paymentCheck.received) {
              logger.info(`Payment detected for Deal #${deal.id}`, { dealId: deal.id, amount: paymentCheck.amount });

              // Confirm payment with distributed lock (atomic operation with idempotency check inside)
              // The distributed lock is already handled inside confirmPayment
              const txHash = paymentCheck.txHash || `auto_${Date.now()}`;
              let confirmedDeal;
              try {
                confirmedDeal = await DealFlowService.confirmPayment(deal.id, txHash);
                logger.info(`Deal #${deal.id} payment confirmed`, { dealId: deal.id, txHash });
              } catch (error: any) {
                if (error.message?.includes('Failed to acquire distributed lock')) {
                  logger.debug(`Deal #${deal.id} payment confirmation skipped (locked by another instance)`, {
                    dealId: deal.id,
                  });
                  continue;
                }
                if (error.message.includes('already confirmed') || error.message.includes('status changed')) {
                  logger.debug(`Deal #${deal.id} payment already confirmed`, { dealId: deal.id });
                  continue;
                }
                throw error;
              }

              if (confirmedDeal && confirmedDeal.payment_tx_hash === txHash) {
                const advertiser = usersMap.get(deal.advertiser_id);
                const channelOwner = usersMap.get(deal.channel_owner_id);

                if (advertiser) {
                  await TelegramService.bot.sendMessage(
                    advertiser.telegram_id,
                    `✅ Payment confirmed for Deal #${deal.id}!\n\n` +
                    `Amount: ${deal.price_ton} TON\n` +
                    `The channel owner will now prepare the creative.\n\n` +
                    `Use /deal ${deal.id} to view details.`
                  ).catch((err: any) => {
                    logger.warn(`Failed to notify advertiser for Deal #${deal.id}`, { dealId: deal.id, error: err.message });
                  });
                }

                if (channelOwner) {
                  await TelegramService.bot.sendMessage(
                    channelOwner.telegram_id,
                    `✅ Payment received for Deal #${deal.id}!\n\n` +
                    `Amount: ${deal.price_ton} TON\n` +
                    `You can now submit the creative.\n\n` +
                    `Use /deal ${deal.id} to view details.`
                  ).catch((err: any) => {
                    logger.warn(`Failed to notify channel owner for Deal #${deal.id}`, { dealId: deal.id, error: err.message });
                  });
                }
              } else {
                logger.debug(`Deal #${deal.id} payment was confirmed by another process, skipping notifications`, {
                  dealId: deal.id,
                  returnedTxHash: confirmedDeal?.payment_tx_hash,
                  attemptedTxHash: txHash,
                });
              }
            }
          } catch (error: any) {
            logger.error(`Error checking payment for Deal #${deal.id}`, { dealId: deal.id, error: error.message, stack: error.stack });
          }
        }
      } catch (error: any) {
        logger.error('Error in payment check job', { error: error.message, stack: error.stack });
      }
    });

    this.jobs.push(job);
    logger.info('Payment check job started (runs every 2 minutes)');
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
  private static startStatsRefreshJob() {
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
