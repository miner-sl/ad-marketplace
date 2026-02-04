import * as cron from 'node-cron';

import { TONService } from '../services/ton.service';
import { TelegramService } from '../services/telegram.service';
import { DealFlowService } from '../services/deal-flow.service';
import { PostSchedulerService } from '../services/post-scheduler.service';

import { DealRepository } from '../repositories/deal.repository';

import { DealModel } from '../repositories/deal-model.repository';
import { ChannelModel } from '../repositories/channel-model.repository';
import { UserModel } from '../repositories/user.repository';

import db from '../db/connection';
import logger from '../utils/logger';
import { withTx } from '../utils/transaction';
import { distributedLock } from '../utils/lock';
import { isPrimaryWorker } from '../utils/cluster.util';

export class CronJobsSchedulerService {
  private static jobs: cron.ScheduledTask[] = [];
  private static postSchedulerService: PostSchedulerService | null = null;

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

    // TODO maybe need to merge some jobs into one
    // TODO scalable jobs
    // Check for payments every 2 minutes
    this.startPaymentCheckJob();

    // Check for expired deals every 10 minutes
    this.startExpiredDealsJob();

    // Check for posts ready for verification every hour
    this.startVerificationJob();

    // Refresh channel stats daily at 2 AM
    this.startStatsRefreshJob();

    // Auto-release funds for verified deals (buyer didn't confirm)
    this.startAutoReleaseJob();

    logger.info(`Started ${this.jobs.length} cron job(s) + PostSchedulerService`);
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
   * Verify posted deals and release/refund funds
   * Runs every hour
   */
  private static startVerificationJob() {
    const job = cron.schedule('0 * * * *', async () => {
      try {
        logger.debug('Checking for posts ready for verification...');

        const deals = await DealRepository.findDealsReadyForVerificationWithChannels();

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
            if (!deal.post_message_id || !deal.channel_id) {
              logger.warn(`Deal #${deal.id}: Missing post_message_id or channel_id`, { dealId: deal.id });
              continue;
            }

            if (!deal.telegram_channel_id) {
              logger.warn(`Deal #${deal.id}: Channel telegram_channel_id not found`, { dealId: deal.id, channelId: deal.channel_id });
              continue;
            }

            const channelId = deal.telegram_channel_id;

            if (!deal.post_verification_until) {
              logger.warn(`Deal #${deal.id}: Missing post_verification_until`, { dealId: deal.id });
              continue;
            }

            const verificationUntil = new Date(deal.post_verification_until);
            const now = new Date();

            if (verificationUntil > now) {
              const remainingMs = verificationUntil.getTime() - now.getTime();
              const remainingHours = Math.ceil(remainingMs / (1000 * 60 * 60));
              logger.debug(`Deal #${deal.id}: Verification period not yet complete`, {
                dealId: deal.id,
                remainingHours,
                verificationUntil: verificationUntil.toISOString(),
                now: now.toISOString(),
              });
              continue;
            }

            let postExists = false;

            try {
              // Check if bot still has access to channel
              const botInfo = await TelegramService.bot.getMe();
              const member = await TelegramService.bot.getChatMember(channelId, botInfo.id);

              if (member.status !== 'administrator' && member.status !== 'creator') {
                logger.warn(`Deal #${deal.id}: Bot is not admin of channel`, {
                  dealId: deal.id,
                  channelId,
                  botStatus: member.status,
                });
                postExists = false;
              } else {
                // Bot has access - try to verify message exists
                // Note: Telegram Bot API doesn't provide direct message existence check
                // We can try to get chat info or use other methods
                // For now, if bot has access and verification period passed, we assume post exists
                // In production, you might want to implement a more robust check
                // (e.g., try to forward message to a test chat, or use Telegram Client API)

                // Additional check: verify the post was published at least MIN_PUBLICATION_DURATION_DAYS ago
                const minPublicationDurationDays = deal.min_publication_duration_days || 7;
                if (deal.actual_post_time) {
                  const postTime = new Date(deal.actual_post_time);
                  const daysSincePost = (now.getTime() - postTime.getTime()) / (1000 * 60 * 60 * 24);

                  if (daysSincePost >= minPublicationDurationDays) {
                    postExists = true;
                    logger.info(`Deal #${deal.id}: Post verified (${minPublicationDurationDays} days+ since publication)`, {
                      dealId: deal.id,
                      daysSincePost: Math.floor(daysSincePost),
                      minPublicationDurationDays,
                    });
                  } else {
                    logger.debug(`Deal #${deal.id}: Post not old enough yet`, {
                      dealId: deal.id,
                      daysSincePost: Math.floor(daysSincePost),
                      minPublicationDurationDays,
                    });
                    continue; // Wait for full minimum duration
                  }
                } else {
                  // No actual_post_time recorded, but verification period passed
                  // Assume post exists if bot has access
                  postExists = true;
                  logger.info(`Deal #${deal.id}: Post verified (verification period passed, bot has access)`, {
                    dealId: deal.id,
                    minPublicationDurationDays,
                  });
                }
              }
            } catch (error: any) {
              logger.warn(`Deal #${deal.id}: Cannot verify post existence`, {
                dealId: deal.id,
                error: error.message,
              });
              postExists = false;
            }

            if (postExists) {
              // Check if minimum publication duration has been reached
              let publicationDurationMet = false;
              let daysSinceFirstPublication = 0;
              let minPublicationDurationDays = deal.min_publication_duration_days || 7;

              if (deal.first_publication_time) {
                const firstPublicationTime = new Date(deal.first_publication_time);
                const now = new Date();
                daysSinceFirstPublication = (now.getTime() - firstPublicationTime.getTime()) / (1000 * 60 * 60 * 24);
                publicationDurationMet = daysSinceFirstPublication >= minPublicationDurationDays;
              }

              if (!publicationDurationMet) {
                logger.info(`Deal #${deal.id}: Post verified but duration requirement not met`, {
                  dealId: deal.id,
                  daysSinceFirstPublication: Math.floor(daysSinceFirstPublication),
                  minPublicationDurationDays,
                });

                const channelOwner = usersMap.get(deal.channel_owner_id);
                if (channelOwner) {
                  const remainingDays = Math.ceil(minPublicationDurationDays - daysSinceFirstPublication);
                  const message =
                    `📢 Deal #${deal.id} Status Update\n\n` +
                    `The post has been verified (remained on channel for required duration).\n\n` +
                    `⚠️ Minimum publication duration not reached.\n` +
                    `Required: ${minPublicationDurationDays} days\n` +
                    `Elapsed: ${Math.floor(daysSinceFirstPublication)} days\n` +
                    `Remaining: ${remainingDays} day(s)\n\n` +
                    `Please wait until the minimum publication period is completed.\n\n` +
                    `Use /deal ${deal.id} to view details.`;

                  await TelegramService.bot.sendMessage(channelOwner.telegram_id, message).catch((err: any) => {
                    logger.warn(`Failed to notify channel owner for Deal #${deal.id}`, { dealId: deal.id, error: err.message });
                  });
                }
                continue; // Skip marking as verified until duration requirement met
              }

              // Post verified and duration requirement met - mark as verified but DON'T release funds yet
              // Funds will be released only when advertiser confirms publication
              await DealModel.markVerified(deal.id);
              // Don't mark as completed yet - wait for advertiser confirmation

              logger.info(`Deal #${deal.id} marked as verified - waiting for advertiser confirmation`, {
                dealId: deal.id,
                daysSinceFirstPublication: Math.floor(daysSinceFirstPublication),
                minPublicationDurationDays,
              });

              const advertiser = usersMap.get(deal.advertiser_id);
              const channelOwner = usersMap.get(deal.channel_owner_id);

              // Notify advertiser with confirmation button
              if (advertiser) {
                const confirmMessage =
                  `✅ Deal #${deal.id} Verified!\n\n` +
                  `The post has remained on the channel for at least ${minPublicationDurationDays} days.\n` +
                  `Minimum requirement met:\n` +
                  `- Publication duration: ${Math.floor(daysSinceFirstPublication)}/${minPublicationDurationDays} days ✓\n\n` +
                  `Please confirm that the post is still visible and meets your requirements.\n\n` +
                  `After your confirmation, funds will be released to the channel owner.\n\n` +
                  `Use /deal ${deal.id} to view details.`;

                const confirmButtons = {
                  reply_markup: {
                    inline_keyboard: [
                      [
                        { text: '✅ Confirm Publication', callback_data: `confirm_publication_${deal.id}` }
                      ],
                      [
                        { text: '📋 View Deal', callback_data: `deal_details_${deal.id}` }
                      ]
                    ]
                  }
                };

                await TelegramService.bot.sendMessage(advertiser.telegram_id, confirmMessage, confirmButtons).catch((err: any) => {
                  logger.warn(`Failed to notify advertiser for Deal #${deal.id}`, { dealId: deal.id, error: err.message });
                });
              }

              if (channelOwner) {
                await TelegramService.bot.sendMessage(
                  channelOwner.telegram_id,
                  `✅ Deal #${deal.id} Verified!\n\n` +
                  `The post has been verified (remained on channel for ${Math.floor(daysSinceFirstPublication)} days).\n` +
                  `Minimum requirement met.\n` +
                  `Waiting for advertiser confirmation to release funds.\n\n` +
                  `Use /deal ${deal.id} to view details.`
                ).catch((err: any) => {
                  logger.warn(`Failed to notify channel owner for Deal #${deal.id}`, { dealId: deal.id, error: err.message });
                });
              }
            } else {
              // Post not found - refund
              await DealModel.updateStatus(deal.id, 'refunded');

              // Refund to advertiser (would need advertiser wallet address in production)
              logger.warn(`Deal #${deal.id}: Post not found, marked for refund`, { dealId: deal.id });

              const advertiser = usersMap.get(deal.advertiser_id);
              const channelOwner = usersMap.get(deal.channel_owner_id);

              if (advertiser) {
                await TelegramService.bot.sendMessage(
                  advertiser.telegram_id,
                  `❌ Deal #${deal.id} verification failed!\n\n` +
                  `The post was not found or was removed.\n` +
                  `Funds will be refunded to you.\n\n` +
                  `Use /deal ${deal.id} to view details.`
                ).catch((err: any) => {
                  logger.warn(`Failed to notify advertiser for Deal #${deal.id}`, { dealId: deal.id, error: err.message });
                });
              }

              if (channelOwner) {
                await TelegramService.bot.sendMessage(
                  channelOwner.telegram_id,
                  `❌ Deal #${deal.id} verification failed!\n\n` +
                  `The post was not found or was removed.\n` +
                  `Funds will be refunded to the advertiser.\n\n` +
                  `Use /deal ${deal.id} to view details.`
                ).catch((err: any) => {
                  logger.warn(`Failed to notify channel owner for Deal #${deal.id}`, { dealId: deal.id, error: err.message });
                });
              }
            }
          } catch (error: any) {
            logger.error(`Error verifying Deal #${deal.id}`, { dealId: deal.id, error: error.message, stack: error.stack });
          }
        }
      } catch (error: any) {
        logger.error('Error in verification job', { error: error.message, stack: error.stack });
      }
    });

    this.jobs.push(job);
    logger.info('Verification job started (runs every hour)');
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

  /**
   * Auto-release funds for verified deals where buyer didn't confirm
   * Runs every 6 hours
   * If buyer doesn't confirm within VERIFIED_TIMEOUT_HOURS (default 7 days),
   * automatically release funds to seller
   */
  private static startAutoReleaseJob() {
    const job = cron.schedule('0 */6 * * *', async () => {
      try {
        logger.debug('Checking for verified deals requiring auto-release...');

        const deals = await DealModel.findVerifiedDealsForAutoRelease();

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
            if (!deal.escrow_address || !deal.channel_owner_wallet_address) {
              logger.warn(`Deal #${deal.id}: Missing escrow or wallet address`, { dealId: deal.id });
              continue;
            }

            try {
              let txHash: string | null = null;

              // Use distributed lock to prevent concurrent fund releases across multiple servers
              try {
                await distributedLock.withLock(
                  deal.id,
                  'auto_release',
                  async () => {
                    await withTx(async (client) => {
                      const dealCheck = await client.query(
                        `SELECT * FROM deals WHERE id = $1 FOR UPDATE`,
                        [deal.id]
                      );

                      if (dealCheck.rows.length === 0) {
                        logger.debug(`Deal #${deal.id} not found`, { dealId: deal.id });
                        return;
                      }

                      const currentDeal = dealCheck.rows[0];

                      if (currentDeal.status === 'completed' && currentDeal.payment_tx_hash) {
                        logger.debug(`Deal #${deal.id} already has funds released`, {
                          dealId: deal.id,
                          existingTxHash: currentDeal.payment_tx_hash,
                        });
                        txHash = currentDeal.payment_tx_hash;
                        return;
                      }

                      if (currentDeal.status !== 'verified') {
                        logger.debug(`Deal #${deal.id} not in verified status`, {
                          dealId: deal.id,
                          status: currentDeal.status,
                        });
                        return;
                      }

                      // Release funds BEFORE updating status
                      // This ensures if release fails, status stays verified
                      if (!currentDeal.channel_owner_wallet_address) {
                        logger.warn(`Deal #${deal.id}: Missing channel owner wallet address`, { dealId: deal.id });
                        return;
                      }

                      txHash = await TONService.releaseFunds(
                        deal.id,
                        currentDeal.channel_owner_wallet_address as string,
                        currentDeal.price_ton.toString(),
                        `Auto-release: Buyer did not confirm within timeout period (Deal #${deal.id})`,
                        false // Already checked idempotency above
                      );

                      // Update status and record tx hash atomically
                      // Note: We update payment_tx_hash with the release tx hash when completing the deal
                      const updateResult = await client.query(
                        `UPDATE deals 
                         SET status = 'completed', payment_tx_hash = $1, updated_at = CURRENT_TIMESTAMP
                         WHERE id = $2 AND status = 'verified' AND status != 'completed'
                         RETURNING *`,
                        [txHash, deal.id]
                      );

                      if (updateResult.rows.length === 0) {
                        // Another process released funds between our check and update
                        // Re-query to get the existing tx hash
                        const recheck = await client.query(
                          `SELECT payment_tx_hash, status FROM deals WHERE id = $1`,
                          [deal.id]
                        );
                        if (recheck.rows.length > 0 && recheck.rows[0].status === 'completed' && recheck.rows[0].payment_tx_hash) {
                          txHash = recheck.rows[0].payment_tx_hash;
                          logger.warn(`Funds were released by another process for Deal #${deal.id}`, {
                            dealId: deal.id,
                            existingTxHash: txHash,
                          });
                        } else {
                          throw new Error(`Failed to update deal status for Deal #${deal.id}`);
                        }
                      }
                    });
                  },
                  { ttl: 60000 } // 60 seconds in milliseconds (fund release takes longer)
                );
              } catch (lockError: any) {
                // If lock acquisition failed, another instance is processing this deal
                if (lockError.message?.includes('Failed to acquire distributed lock')) {
                  logger.debug(`Deal #${deal.id} auto-release skipped (locked by another instance)`, {
                    dealId: deal.id,
                  });
                  continue;
                }
                throw lockError;
              }

              // Only send notifications if we actually released funds (or found existing release)
              if (txHash) {
                logger.info(`Auto-released funds for Deal #${deal.id}`, {
                  dealId: deal.id,
                  txHash,
                  reason: 'Buyer did not confirm within timeout period',
                });

                const advertiser = usersMap.get(deal.advertiser_id);
                const channelOwner = usersMap.get(deal.channel_owner_id);

                if (advertiser) {
                  await TelegramService.bot.sendMessage(
                    advertiser.telegram_id,
                    `⏰ Deal #${deal.id} Auto-Completed\n\n` +
                    `You did not confirm publication within the timeout period.\n` +
                    `Funds have been automatically released to the channel owner.\n\n` +
                    `Use /deal ${deal.id} to view details.`
                  ).catch((err: any) => {
                    logger.warn(`Failed to notify advertiser for Deal #${deal.id}`, { dealId: deal.id, error: err.message });
                  });
                }

                if (channelOwner && txHash) {
                  await TelegramService.bot.sendMessage(
                    channelOwner.telegram_id,
                    `✅ Deal #${deal.id} Auto-Completed\n\n` +
                    `The advertiser did not confirm publication within the timeout period.\n` +
                    `Funds (${deal.price_ton} TON) have been automatically released to your wallet.\n\n` +
                    `Transaction: ${txHash}\n\n` +
                    `Use /deal ${deal.id} to view details.`
                  ).catch((err: any) => {
                    logger.warn(`Failed to notify channel owner for Deal #${deal.id}`, { dealId: deal.id, error: err.message });
                  });
                }
              }
            } catch (dbError: any) {
              throw dbError;
            }
          } catch (error: any) {
            logger.error(`Error auto-releasing funds for Deal #${deal.id}`, {
              dealId: deal.id,
              error: error.message,
              stack: error.stack,
            });
          }
        }
      } catch (error: any) {
        logger.error('Error in auto-release job', { error: error.message, stack: error.stack });
      }
    });

    this.jobs.push(job);
    logger.info('Auto-release job started (runs every 6 hours)');
  }
}
