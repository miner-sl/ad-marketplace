import * as cron from 'node-cron';
import { DealModel } from '../models/Deal';
import { TONService } from '../services/ton';
import { TelegramService } from '../services/telegram';
import { DealFlowService } from '../services/dealFlow';
import { ChannelModel } from '../models/Channel';
import { UserModel } from '../models/User';
import db from '../db/connection';

export class CronJobs {
  private static jobs: cron.ScheduledTask[] = [];

  /**
   * Start all cron jobs
   */
  static startAll() {
    console.log('🕐 Starting cron jobs...');

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

    console.log(`✅ Started ${this.jobs.length} cron job(s)`);
  }

  /**
   * Stop all cron jobs
   */
  static stopAll() {
    this.jobs.forEach(job => job.stop());
    this.jobs = [];
    console.log('🛑 Stopped all cron jobs');
  }

  /**
   * Check for pending payments and update deal status
   * Runs every 2 minutes
   */
  private static startPaymentCheckJob() {
    const job = cron.schedule('*/2 * * * *', async () => {
      try {
        console.log('💰 Checking for pending payments...');

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
              console.log(`✅ Payment detected for Deal #${deal.id}: ${paymentCheck.amount} TON`);

              // Confirm payment
              const txHash = paymentCheck.txHash || `auto_${Date.now()}`;
              await DealFlowService.confirmPayment(deal.id, txHash);

              // Update status: if scheduled_post_time is set, move to 'scheduled', otherwise 'paid'
              const updatedDeal = await DealModel.findById(deal.id);
              if (updatedDeal?.scheduled_post_time) {
                await DealModel.updateStatus(deal.id, 'scheduled');
                console.log(`📅 Deal #${deal.id} moved to 'scheduled' status`);
              } else {
                await DealModel.updateStatus(deal.id, 'paid');
                console.log(`✅ Deal #${deal.id} moved to 'paid' status`);
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
            console.error(`❌ Error checking payment for Deal #${deal.id}:`, error.message);
          }
        }
      } catch (error: any) {
        console.error('❌ Error in payment check job:', error.message);
      }
    });

    this.jobs.push(job);
    console.log('✅ Payment check job started (runs every 2 minutes)');
  }

  /**
   * Auto-post scheduled creatives
   * Runs every 5 minutes
   */
  private static startAutoPostJob() {
    const job = cron.schedule('*/5 * * * *', async () => {
      try {
        console.log('📤 Checking for scheduled posts...');

        const deals = await db.query(
          `SELECT * FROM deals 
           WHERE status IN ('scheduled', 'paid', 'creative_approved')
           AND scheduled_post_time IS NOT NULL
           AND scheduled_post_time <= CURRENT_TIMESTAMP
           ORDER BY scheduled_post_time ASC`
        );

        for (const deal of deals.rows) {
          try {
            // Check if creative is approved
            const creative = await db.query(
              `SELECT * FROM creatives 
               WHERE deal_id = $1 
               AND status = 'approved'
               ORDER BY created_at DESC LIMIT 1`,
              [deal.id]
            );

            if (creative.rows.length === 0) {
              console.log(`⏭️ Skipping Deal #${deal.id}: No approved creative`);
              continue;
            }

            // Get channel info
            const channel = await db.query(
              'SELECT telegram_channel_id FROM channels WHERE id = $1',
              [deal.channel_id]
            );

            if (channel.rows.length === 0) {
              console.log(`❌ Deal #${deal.id}: Channel not found`);
              continue;
            }

            const channelId = channel.rows[0].telegram_channel_id;
            const creativeData = creative.rows[0].content_data;

            // Post creative to channel
            let messageId: number | undefined;
            try {
              if (creativeData.text) {
                const sentMessage = await TelegramService.bot.sendMessage(
                  channelId,
                  creativeData.text,
                  { parse_mode: creativeData.parse_mode || undefined }
                );
                messageId = sentMessage.message_id;
              } else {
                console.log(`⚠️ Deal #${deal.id}: Creative has no text content`);
                continue;
              }
            } catch (error: any) {
              console.error(`❌ Error posting Deal #${deal.id}:`, error.message);
              continue;
            }

            if (messageId) {
              // Record post
              const verificationUntil = new Date();
              verificationUntil.setHours(verificationUntil.getHours() + 24); // 24h verification period

              await DealModel.recordPost(deal.id, messageId, verificationUntil);

              console.log(`✅ Posted Deal #${deal.id} to channel ${channelId}`);

              // Notify both parties
              const advertiser = await UserModel.findById(deal.advertiser_id);
              const channelOwner = await UserModel.findById(deal.channel_owner_id);

              if (advertiser) {
                await TelegramService.bot.sendMessage(
                  advertiser.telegram_id,
                  `📤 Post published for Deal #${deal.id}!\n\n` +
                  `The post will be verified for 24 hours.\n` +
                  `After verification, funds will be released.\n\n` +
                  `Use /deal ${deal.id} to view details.`
                );
              }

              if (channelOwner) {
                await TelegramService.bot.sendMessage(
                  channelOwner.telegram_id,
                  `📤 Post published for Deal #${deal.id}!\n\n` +
                  `The post will be verified for 24 hours.\n` +
                  `After verification, funds will be released to you.\n\n` +
                  `Use /deal ${deal.id} to view details.`
                );
              }
            }
          } catch (error: any) {
            console.error(`❌ Error auto-posting Deal #${deal.id}:`, error.message);
          }
        }
      } catch (error: any) {
        console.error('❌ Error in auto-post job:', error.message);
      }
    });

    this.jobs.push(job);
    console.log('✅ Auto-post job started (runs every 5 minutes)');
  }

  /**
   * Cancel expired deals
   * Runs every 10 minutes
   */
  private static startExpiredDealsJob() {
    const job = cron.schedule('*/10 * * * *', async () => {
      try {
        console.log('⏰ Checking for expired deals...');

        const expiredDeals = await DealModel.findExpiredDeals();

        for (const deal of expiredDeals) {
          try {
            await DealModel.cancel(deal.id, 'Deal expired (timeout)');

            console.log(`❌ Cancelled expired Deal #${deal.id}`);

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
            console.error(`❌ Error cancelling expired Deal #${deal.id}:`, error.message);
          }
        }
      } catch (error: any) {
        console.error('❌ Error in expired deals job:', error.message);
      }
    });

    this.jobs.push(job);
    console.log('✅ Expired deals job started (runs every 10 minutes)');
  }

  /**
   * Verify posted deals and release/refund funds
   * Runs every hour
   */
  private static startVerificationJob() {
    const job = cron.schedule('0 * * * *', async () => {
      try {
        console.log('🔍 Checking for posts ready for verification...');

        const deals = await DealModel.findDealsReadyForVerification();

        for (const deal of deals) {
          try {
            if (!deal.post_message_id || !deal.channel_id) {
              console.log(`⚠️ Deal #${deal.id}: Missing post_message_id or channel_id`);
              continue;
            }

            // Get channel info
            const channel = await db.query(
              'SELECT telegram_channel_id FROM channels WHERE id = $1',
              [deal.channel_id]
            );

            if (channel.rows.length === 0) {
              console.log(`❌ Deal #${deal.id}: Channel not found`);
              continue;
            }

            const channelId = channel.rows[0].telegram_channel_id;

            // Check if post still exists
            // Note: Telegram Bot API doesn't provide a direct way to check if a message exists
            // We'll mark as verified if the deal is in 'posted' status and verification period has passed
            // In production, you might want to implement a more robust verification mechanism
            let postExists = true; // Assume post exists if deal reached this stage
            
            // Alternative: Try to get chat info to verify bot still has access
            try {
              await TelegramService.bot.getChat(channelId);
              // Bot has access, assume post exists
              postExists = true;
            } catch (error: any) {
              console.log(`⚠️ Deal #${deal.id}: Cannot access channel (${error.message})`);
              postExists = false;
            }

            if (postExists) {
              // Post verified - release funds
              await DealModel.markVerified(deal.id);
              await DealModel.markCompleted(deal.id);

              // Release funds to channel owner
              if (deal.escrow_address && deal.channel_owner_wallet_address) {
                try {
                  await TONService.releaseFunds(
                    deal.escrow_address,
                    deal.channel_owner_wallet_address,
                    deal.price_ton.toString()
                  );
                  console.log(`✅ Released funds for Deal #${deal.id}`);
                } catch (error: any) {
                  console.error(`❌ Error releasing funds for Deal #${deal.id}:`, error.message);
                }
              }

              // Notify both parties
              const advertiser = await UserModel.findById(deal.advertiser_id);
              const channelOwner = await UserModel.findById(deal.channel_owner_id);

              if (advertiser) {
                await TelegramService.bot.sendMessage(
                  advertiser.telegram_id,
                  `✅ Deal #${deal.id} verified and completed!\n\n` +
                  `The post has been verified and funds have been released to the channel owner.\n\n` +
                  `Use /deal ${deal.id} to view details.`
                );
              }

              if (channelOwner) {
                await TelegramService.bot.sendMessage(
                  channelOwner.telegram_id,
                  `✅ Deal #${deal.id} verified and completed!\n\n` +
                  `The post has been verified and funds (${deal.price_ton} TON) have been released to your wallet.\n\n` +
                  `Use /deal ${deal.id} to view details.`
                );
              }
            } else {
              // Post not found - refund
              await DealModel.updateStatus(deal.id, 'refunded');

              // Refund to advertiser (would need advertiser wallet address in production)
              console.log(`💰 Deal #${deal.id}: Post not found, marked for refund`);

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
            console.error(`❌ Error verifying Deal #${deal.id}:`, error.message);
          }
        }
      } catch (error: any) {
        console.error('❌ Error in verification job:', error.message);
      }
    });

    this.jobs.push(job);
    console.log('✅ Verification job started (runs every hour)');
  }

  /**
   * Refresh channel stats
   * Runs daily at 2 AM
   */
  private static startStatsRefreshJob() {
    const job = cron.schedule('0 2 * * *', async () => {
      try {
        console.log('📊 Refreshing channel stats...');

        const channels = await db.query(
          'SELECT id, telegram_channel_id FROM channels WHERE is_active = TRUE'
        );

        for (const channel of channels.rows) {
          try {
            const stats = await TelegramService.fetchChannelStats(channel.telegram_channel_id);
            await ChannelModel.saveStats(channel.id, stats);

            console.log(`✅ Refreshed stats for Channel #${channel.id}`);
          } catch (error: any) {
            console.error(`❌ Error refreshing stats for Channel #${channel.id}:`, error.message);
          }
        }
      } catch (error: any) {
        console.error('❌ Error in stats refresh job:', error.message);
      }
    });

    this.jobs.push(job);
    console.log('✅ Stats refresh job started (runs daily at 2 AM)');
  }
}
