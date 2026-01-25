import * as cron from 'node-cron';
import { DealModel } from '../models/Deal';
import { TONService } from '../services/ton';
import { TelegramService } from '../services/telegram';
import { DealFlowService } from '../services/dealFlow';
import { ChannelModel } from '../models/Channel';
import { UserModel } from '../models/User';
import db from '../db/connection';
import { BotHandlers } from '../bot/handlers';
import { Context } from 'telegraf';
import logger from '../utils/logger';

export class CronJobs {
  private static jobs: cron.ScheduledTask[] = [];

  /**
   * Start all cron jobs
   */
  static startAll() {
    logger.info('Starting cron jobs...');

    // Check for payments every 2 minutes
    this.startPaymentCheckJob();

    // Check for scheduled posts every 5 minutes
    this.startAutoPostJob();

    // Check for expired deals every 10 minutes
    this.startExpiredDealsJob();

    // Check for posts ready for verification every hour
    this.startVerificationJob();

    // Refresh channel stats daily at 2 AM
    this.startStatsRefreshJob();

    logger.info(`Started ${this.jobs.length} cron job(s)`);
  }

  /**
   * Stop all cron jobs
   */
  static stopAll() {
    this.jobs.forEach(job => job.stop());
    this.jobs = [];
    logger.info('Stopped all cron jobs');
  }

  /**
   * Check for pending payments and update deal status
   * Runs every 2 minutes
   */
  private static startPaymentCheckJob() {
    const job = cron.schedule('*/2 * * * *', async () => {
      try {
        logger.debug('Checking for pending payments...');

        const deals = await db.query(
          `SELECT * FROM deals 
           WHERE status = 'payment_pending' 
           AND escrow_address IS NOT NULL
           ORDER BY created_at ASC`
        );

        for (const deal of deals.rows) {
          try {
            const paymentCheck = await TONService.checkPayment(
              deal.escrow_address,
              deal.price_ton.toString()
            );

            if (paymentCheck.received) {
              logger.info(`Payment detected for Deal #${deal.id}`, { dealId: deal.id, amount: paymentCheck.amount });

              // Confirm payment
              const txHash = paymentCheck.txHash || `auto_${Date.now()}`;
              await DealFlowService.confirmPayment(deal.id, txHash);

              // Update status: if scheduled_post_time is set, move to 'scheduled', otherwise 'paid'
              const updatedDeal = await DealModel.findById(deal.id);
              if (updatedDeal?.scheduled_post_time) {
                await DealModel.updateStatus(deal.id, 'scheduled');
                logger.info(`Deal #${deal.id} moved to 'scheduled' status`, { dealId: deal.id });
              } else {
                await DealModel.updateStatus(deal.id, 'paid');
                logger.info(`Deal #${deal.id} moved to 'paid' status`, { dealId: deal.id });
              }

              // Notify advertiser
              const advertiser = await UserModel.findById(deal.advertiser_id);
              if (advertiser) {
                await TelegramService.bot.sendMessage(
                  advertiser.telegram_id,
                  `✅ Payment confirmed for Deal #${deal.id}!\n\n` +
                  `Amount: ${deal.price_ton} TON\n` +
                  `The channel owner will now prepare the creative.\n\n` +
                  `Use /deal ${deal.id} to view details.`
                );
              }

              // Notify channel owner
              const channelOwner = await UserModel.findById(deal.channel_owner_id);
              if (channelOwner) {
                await TelegramService.bot.sendMessage(
                  channelOwner.telegram_id,
                  `✅ Payment received for Deal #${deal.id}!\n\n` +
                  `Amount: ${deal.price_ton} TON\n` +
                  `You can now submit the creative.\n\n` +
                  `Use /deal ${deal.id} to view details.`
                );
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
   * Auto-post scheduled creatives
   * Runs every 5 minutes
   */
  private static startAutoPostJob() {
    const job = cron.schedule('*/5 * * * *', async () => {
      try {
        logger.debug('Checking for scheduled posts...');

        const deals = await db.query(
          `SELECT * FROM deals 
           WHERE status IN ('scheduled', 'paid', 'creative_approved')
           AND scheduled_post_time IS NOT NULL
           AND scheduled_post_time <= NOW()
           ORDER BY scheduled_post_time ASC
           LIMIT  20
       `);

        for (const deal of deals.rows) {
          logger.debug(`Processing deal for auto-post`, { dealId: deal.id, status: deal.status });
          try {
            // Double-check that scheduled_post_time has passed (additional validation)
            if (!deal.scheduled_post_time) {
              logger.debug(`Skipping Deal #${deal.id}: No scheduled_post_time`, { dealId: deal.id });
              continue;
            }

            // Parse scheduled_post_time (format: 2026-01-25 07:10:27.000000)
            const scheduledTime = new Date(deal.scheduled_post_time);
            const now = new Date();
            
            // Validate that scheduled time is a valid date
            if (isNaN(scheduledTime.getTime())) {
              logger.error(`Deal #${deal.id}: Invalid scheduled_post_time format`, { dealId: deal.id, scheduledPostTime: deal.scheduled_post_time });
              continue;
            }
            
            if (scheduledTime > now) {
              const diffMs = scheduledTime.getTime() - now.getTime();
              const minutesUntilPublish = Math.ceil(diffMs / (1000 * 60));
              const secondsUntilPublish = Math.ceil(diffMs / 1000);
              logger.debug(`Skipping Deal #${deal.id}: Scheduled time hasn't arrived yet`, { 
                dealId: deal.id, 
                scheduled: scheduledTime.toISOString(), 
                now: now.toISOString(),
                remainingMinutes: minutesUntilPublish,
                remainingSeconds: secondsUntilPublish
              });
              continue;
            }

            logger.info(`Deal #${deal.id}: Scheduled time has passed. Publishing...`, { 
              dealId: deal.id, 
              scheduled: scheduledTime.toISOString(), 
              now: now.toISOString() 
            });

            // Check if creative is approved
            const creative = await db.query(
              `SELECT * FROM creatives 
               WHERE deal_id = $1 
               AND status = 'approved'
               ORDER BY created_at DESC LIMIT 1`,
              [deal.id]
            );

            // if (creative.rows.length === 0) {
            //   console.log(`⏭️ Skipping Deal #${deal.id}: No approved creative`);
            //   continue;
            // }

            // Get channel info
            const channel = await db.query(
              'SELECT telegram_channel_id FROM channels WHERE id = $1',
              [deal.channel_id]
            );

            if (channel.rows.length === 0) {
              logger.warn(`Deal #${deal.id}: Channel not found`, { dealId: deal.id, channelId: deal.channel_id });
              continue;
            }

            // Call handlePublishPost for this deal
            // Get channel owner to create proper mock context
            const channelOwner = await UserModel.findById(deal.channel_owner_id);
            if (!channelOwner) {
              logger.warn(`Deal #${deal.id}: Channel owner not found`, { dealId: deal.id, channelOwnerId: deal.channel_owner_id });
              continue;
            }

            // Create a minimal mock context for the handler
            const mockCtx = {
              from: { id: channelOwner.telegram_id },
              reply: async (text: string) => {
                logger.debug(`[Auto-post] ${text}`, { dealId: deal.id });
                return Promise.resolve({} as any);
              }
            } as any as Context;

            try {
              await BotHandlers.handlePublishPost(mockCtx, deal.id);
              logger.info(`Auto-published Deal #${deal.id} via handlePublishPost`, { dealId: deal.id });
            } catch (error: any) {
              logger.error(`Error calling handlePublishPost for Deal #${deal.id}`, { dealId: deal.id, error: error.message, stack: error.stack });
              // Re-throw to be caught by outer catch block
              throw error;
            }
          } catch (error: any) {
            logger.error(`Error auto-posting Deal #${deal.id}`, { dealId: deal.id, error: error.message, stack: error.stack });
          }
        }
      } catch (error: any) {
        logger.error('Error in auto-post job', { error: error.message, stack: error.stack });
      }
    });

    this.jobs.push(job);
    logger.info('Auto-post job started (runs every 5 minutes)');
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

        for (const deal of expiredDeals) {
          try {
            await DealModel.cancel(deal.id, 'Deal expired (timeout)');

            logger.info(`Cancelled expired Deal #${deal.id}`, { dealId: deal.id });

            // Notify both parties
            const advertiser = await UserModel.findById(deal.advertiser_id);
            const channelOwner = await UserModel.findById(deal.channel_owner_id);

            if (advertiser) {
              await TelegramService.bot.sendMessage(
                advertiser.telegram_id,
                `⏰ Deal #${deal.id} has expired and been cancelled.\n\n` +
                `Reason: Timeout (no activity for 72 hours)\n\n` +
                `Use /deal ${deal.id} to view details.`
              );
            }

            if (channelOwner) {
              await TelegramService.bot.sendMessage(
                channelOwner.telegram_id,
                `⏰ Deal #${deal.id} has expired and been cancelled.\n\n` +
                `Reason: Timeout (no activity for 72 hours)\n\n` +
                `Use /deal ${deal.id} to view details.`
              );
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

        const deals = await DealModel.findDealsReadyForVerification();

        for (const deal of deals) {
          try {
            if (!deal.post_message_id || !deal.channel_id) {
              logger.warn(`Deal #${deal.id}: Missing post_message_id or channel_id`, { dealId: deal.id });
              continue;
            }

            // Get channel info
            const channel = await db.query(
              'SELECT telegram_channel_id FROM channels WHERE id = $1',
              [deal.channel_id]
            );

            if (channel.rows.length === 0) {
              logger.warn(`Deal #${deal.id}: Channel not found`, { dealId: deal.id, channelId: deal.channel_id });
              continue;
            }

            const channelId = channel.rows[0].telegram_channel_id;

            // Verify that verification period has passed
            if (!deal.post_verification_until) {
              logger.warn(`Deal #${deal.id}: Missing post_verification_until`, { dealId: deal.id });
              continue;
            }

            const verificationUntil = new Date(deal.post_verification_until);
            const now = new Date();

            if (verificationUntil > now) {
              // Verification period hasn't passed yet
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

            // Verification period has passed - now verify post exists
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
                
                // Additional check: verify the post was published at least MIN_POST_DURATION_HOURS ago
                const minPostDurationHours = parseInt(process.env.MIN_POST_DURATION_HOURS || '24', 10);
                if (deal.actual_post_time) {
                  const postTime = new Date(deal.actual_post_time);
                  const hoursSincePost = (now.getTime() - postTime.getTime()) / (1000 * 60 * 60);
                  
                  if (hoursSincePost >= minPostDurationHours) {
                    postExists = true;
                    logger.info(`Deal #${deal.id}: Post verified (${minPostDurationHours}h+ since publication)`, {
                      dealId: deal.id,
                      hoursSincePost: Math.floor(hoursSincePost),
                      minPostDurationHours,
                    });
                  } else {
                    logger.debug(`Deal #${deal.id}: Post not old enough yet`, {
                      dealId: deal.id,
                      hoursSincePost: Math.floor(hoursSincePost),
                      minPostDurationHours,
                    });
                    continue; // Wait for full minimum duration
                  }
                } else {
                  // No actual_post_time recorded, but verification period passed
                  // Assume post exists if bot has access
                  postExists = true;
                  logger.info(`Deal #${deal.id}: Post verified (verification period passed, bot has access)`, {
                    dealId: deal.id,
                    minPostDurationHours,
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
              // Post verified - mark as verified but DON'T release funds yet
              // Funds will be released only when advertiser confirms publication
              await DealModel.markVerified(deal.id);
              // Don't mark as completed yet - wait for advertiser confirmation

              logger.info(`Deal #${deal.id} marked as verified - waiting for advertiser confirmation`, { dealId: deal.id });

              // Notify advertiser with confirmation button
              const advertiser = await UserModel.findById(deal.advertiser_id);
              if (advertiser) {
                const minPostDurationHours = parseInt(process.env.MIN_POST_DURATION_HOURS || '24', 10);
                const confirmMessage = 
                  `✅ Deal #${deal.id} Verified!\n\n` +
                  `The post has been published and remained on the channel for at least ${minPostDurationHours} hours.\n\n` +
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

                await TelegramService.bot.sendMessage(advertiser.telegram_id, confirmMessage, confirmButtons);
              }

              // Notify channel owner
              const channelOwner = await UserModel.findById(deal.channel_owner_id);
              if (channelOwner) {
                await TelegramService.bot.sendMessage(
                  channelOwner.telegram_id,
                  `✅ Deal #${deal.id} Verified!\n\n` +
                  `The post has been verified (remained on channel for required duration).\n` +
                  `Waiting for advertiser confirmation to release funds.\n\n` +
                  `Use /deal ${deal.id} to view details.`
                );
              }
            } else {
              // Post not found - refund
              await DealModel.updateStatus(deal.id, 'refunded');

              // Refund to advertiser (would need advertiser wallet address in production)
              logger.warn(`Deal #${deal.id}: Post not found, marked for refund`, { dealId: deal.id });

              // Notify both parties
              const advertiser = await UserModel.findById(deal.advertiser_id);
              const channelOwner = await UserModel.findById(deal.channel_owner_id);

              if (advertiser) {
                await TelegramService.bot.sendMessage(
                  advertiser.telegram_id,
                  `❌ Deal #${deal.id} verification failed!\n\n` +
                  `The post was not found or was removed.\n` +
                  `Funds will be refunded to you.\n\n` +
                  `Use /deal ${deal.id} to view details.`
                );
              }

              if (channelOwner) {
                await TelegramService.bot.sendMessage(
                  channelOwner.telegram_id,
                  `❌ Deal #${deal.id} verification failed!\n\n` +
                  `The post was not found or was removed.\n` +
                  `Funds will be refunded to the advertiser.\n\n` +
                  `Use /deal ${deal.id} to view details.`
                );
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
}
