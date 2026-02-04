import { DealModel } from '../repositories/deal-model.repository';
import { ChannelModel } from '../repositories/channel-model.repository';
import { UserModel } from '../repositories/user.repository';
import { TONService } from './ton.service';
import { CreativeService } from './creative.service';
import { PostService } from './post.service';
import { withTx } from '../utils/transaction';
import db from '../db/connection';
import { DealRepository } from '../repositories/deal.repository';
import { ChannelRepository } from '../repositories/channel.repository';
import logger from '../utils/logger';
import { distributedLock } from '../utils/lock';

export class DealFlowService {
  /**
   * Initialize/create a new deal
   * Uses transaction to ensure atomicity when creating deal, setting publish_date, and storing postText
   */
  static async initializeDeal(data: {
    deal_type: 'listing' | 'campaign';
    listing_id?: number;
    campaign_id?: number;
    channel_id: number;
    channel_owner_id: number;
    advertiser_id: number;
    ad_format: string;
    price_ton: number;
    timeout_hours?: number;
    publish_date?: Date;
    postText?: string;
  }): Promise<any> {
    return await withTx(async (client) => {
      const channelCheck = await client.query(
        `SELECT id, owner_id FROM channels WHERE id = $1`,
        [data.channel_id]
      );

      if (!channelCheck.rows || channelCheck.rows.length === 0) {
        throw new Error(`Channel with id ${data.channel_id} not found`);
      }

      const channel = channelCheck.rows[0];
      if (channel.owner_id !== data.channel_owner_id) {
        throw new Error(`Channel owner mismatch. Channel ${data.channel_id} is owned by user ${channel.owner_id}, not ${data.channel_owner_id}`);
      }

      // Get user from database by telegram_id (advertiser_id is telegram_id)
      const userResult = await client.query(
        'SELECT * FROM users WHERE telegram_id = $1',
        [data.advertiser_id]
      );

      if (!userResult.rows || userResult.rows.length === 0) {
        throw new Error(`User with telegram_id ${data.advertiser_id} not found. Please register first.`);
      }

      const advertiserDbId = userResult.rows[0].id;

      const timeoutHours = data.timeout_hours || 72;
      const timeoutAt = new Date();
      timeoutAt.setUTCHours(timeoutAt.getUTCHours() + timeoutHours);
      const utcTimeoutAt = new Date(timeoutAt.toISOString());

      const dealResult = await client.query(
        `INSERT INTO deals (
          deal_type, listing_id, campaign_id, channel_id, channel_owner_id,
          advertiser_id, ad_format, price_ton, timeout_at, scheduled_post_time
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *`,
        [
          data.deal_type,
          data.listing_id,
          data.campaign_id,
          data.channel_id,
          data.channel_owner_id,
          advertiserDbId,
          data.ad_format,
          data.price_ton,
          utcTimeoutAt,
          data.publish_date || null,
        ]
      );

      const deal = dealResult.rows[0];
      const dealId = deal.id;

      if (data.postText) {
        await client.query(
          `INSERT INTO deal_messages (deal_id, sender_id, message_text)
           VALUES ($1, $2, $3)`,
          [dealId, advertiserDbId, data.postText]
        );
      }

      return deal;
    });
  }

  static async schedulePost(dealId: number, postTime: Date): Promise<any> {
    const deal = await DealModel.findById(dealId);
    if (!deal) {
      throw new Error('Deal not found');
    }

    if (deal.status !== 'paid' && deal.status !== 'scheduled') {
      throw new Error(`Cannot schedule post in status: ${deal.status}`);
    }

    return await DealModel.schedulePost(dealId, postTime);
  }

  /**
   * Accept deal (channel owner accepts advertiser request)
   * Uses transaction to ensure atomicity
   */
  static async acceptDeal(dealId: number, channelOwnerId: number, telegramUserId?: number): Promise<any> {
    return await withTx(async (client) => {
      const user = await UserModel.findByTelegramId(channelOwnerId);
      if (!user) {
        throw new Error('User not found');
      }
      const dealResult = await client.query(
        `SELECT * FROM deals WHERE id = $1 FOR UPDATE`,
        [dealId]
      );

      const deal = dealResult.rows[0];
      if (!deal || deal.channel_owner_id !== user.id) {
        throw new Error('Deal not found or unauthorized');
      }

      if (telegramUserId) {
        const isAdmin = await ChannelModel.verifyAdminStatus(
          deal.channel_id,
          user.id,
          telegramUserId
        );
        if (!isAdmin) {
          throw new Error('You are no longer an admin of this channel');
        }
      }

      if (deal.status !== 'pending' && deal.status !== 'negotiating') {
        throw new Error(`Cannot accept deal in status: ${deal.status}`);
      }

      const ownerWalletAddress = user.wallet_address;
      if (!ownerWalletAddress) {
        throw new Error('Channel owner wallet address not set. Please set your wallet address first.');
      }

      const escrowAddress = await TONService.generateEscrowAddress(dealId);
      const updateResult = await client.query(
        `UPDATE deals 
         SET escrow_address = $1, channel_owner_wallet_address = $2, status = 'payment_pending', updated_at = CURRENT_TIMESTAMP
         WHERE id = $3 AND status IN ('pending', 'negotiating')
         RETURNING *`,
        [escrowAddress, ownerWalletAddress, dealId]
      );

      if (updateResult.rows.length === 0) {
        throw new Error('Deal status changed during processing');
      }

      const updated = updateResult.rows[0];

      return updated;
    });
  }

  /**
   * Advertiser confirms payment (manual confirmation)
   * Uses distributed lock + atomic UPDATE with idempotency checks to prevent race conditions
   */
  static async confirmPayment(dealId: number, txHash: string): Promise<any> {
    return await distributedLock.withLock(
      dealId,
      'confirm_payment',
      async () => {
        return await withTx(async (client) => {
          const dealResult = await client.query(
            `SELECT * FROM deals WHERE id = $1 FOR UPDATE`,
            [dealId]
          );

          const deal = dealResult.rows[0];
          if (!deal) {
            throw new Error('Deal not found');
          }

          if (deal.payment_tx_hash && deal.status !== 'payment_pending') {
            logger.info(`Payment already confirmed for Deal #${dealId}`, {
              dealId,
              existingTxHash: deal.payment_tx_hash,
              currentStatus: deal.status,
            });
            return deal;
          }

          if (deal.status !== 'payment_pending') {
            throw new Error(`Cannot confirm payment in status: ${deal.status}`);
          }

          if (deal.escrow_address && !deal.payment_tx_hash) {
            const paymentCheck = await TONService.checkPayment(
              deal.escrow_address,
              deal.price_ton.toString()
            );

            if (!paymentCheck.received) {
              throw new Error('Payment not confirmed on blockchain');
            }
          }

          const finalStatus = deal.scheduled_post_time ? 'scheduled' : 'paid';
          const updateResult = await client.query(
            `UPDATE deals 
            SET status = $1, payment_tx_hash = $2, payment_confirmed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
            WHERE id = $3 AND status = 'payment_pending' AND payment_tx_hash IS NULL
            RETURNING *`,
            [finalStatus, txHash, dealId]
          );

          if (updateResult.rows.length === 0) {
            const recheck = await client.query(
              `SELECT * FROM deals WHERE id = $1`,
              [dealId]
            );
            if (recheck.rows.length > 0) {
              const currentDeal = recheck.rows[0];
              if (currentDeal.payment_tx_hash) {
                logger.info(`Payment was confirmed by another process for Deal #${dealId}`, {
                  dealId,
                  existingTxHash: currentDeal.payment_tx_hash,
                });
                return currentDeal;
              }
            }
            throw new Error('Payment already confirmed or deal status changed');
          }

          const updated = updateResult.rows[0];

          await client.query(
            `INSERT INTO deal_messages (deal_id, sender_id, message_text)
            VALUES ($1, $2, $3)`,
            [dealId, deal.advertiser_id, `Payment confirmed: ${txHash}`]
          );

          return updated;
        });
      },
      { ttl: 30000 }
    );
  }

  static async submitCreative(dealId: number, submittedBy: number, content: {
    contentType: string;
    contentData: Record<string, any>;
  }): Promise<any> {
    return await withTx(async (client) => {
      const dealResult = await client.query(
        `SELECT * FROM deals WHERE id = $1 FOR UPDATE`,
        [dealId]
      );

      const deal = dealResult.rows[0];
      if (!deal) {
        throw new Error('Deal not found');
      }

      if (deal.status !== 'paid') {
        throw new Error(`Cannot submit creative in status: ${deal.status}`);
      }

      await CreativeService.create({
        deal_id: dealId,
        submitted_by: submittedBy,
        content_type: content.contentType,
        content_data: content.contentData
      });

      await CreativeService.submit(dealId);

      const updateResult = await client.query(
        `UPDATE deals 
         SET status = 'creative_submitted', updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND status = 'paid'
         RETURNING *`,
        [dealId]
      );

      if (updateResult.rows.length === 0) {
        throw new Error('Deal status changed during creative submission');
      }

      return updateResult.rows[0];
    });
  }

  /**
   * Advertiser approves creative
   */
  static async approveCreative(dealId: number, advertiserId: number): Promise<any> {
    return await withTx(async (client) => {
      const dealResult = await client.query(
        `SELECT * FROM deals WHERE id = $1 FOR UPDATE`,
        [dealId]
      );

      const deal = dealResult.rows[0];
      if (!deal || deal.advertiser_id !== advertiserId) {
        throw new Error('Deal not found or unauthorized');
      }

      if (deal.status !== 'creative_submitted') {
        throw new Error(`Cannot approve creative in status: ${deal.status}`);
      }

      await CreativeService.approve(dealId);

      const finalStatus = deal.payment_confirmed_at ? 'paid' : 'creative_approved';

      const updateResult = await client.query(
        `UPDATE deals 
         SET status = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2 AND status = 'creative_submitted'
         RETURNING *`,
        [finalStatus, dealId]
      );

      if (updateResult.rows.length === 0) {
        throw new Error('Deal status changed during creative approval');
      }

      await client.query(
        `INSERT INTO deal_messages (deal_id, sender_id, message_text)
         VALUES ($1, $2, $3)`,
        [dealId, advertiserId, 'Creative approved']
      );

      return updateResult.rows[0];
    });
  }

  /**
   * Request revision of creative
   */
  static async requestRevision(dealId: number, requestedBy: number, notes: string): Promise<any> {
    return await withTx(async (client) => {
      const dealResult = await client.query(
        `SELECT * FROM deals WHERE id = $1 FOR UPDATE`,
        [dealId]
      );

      const deal = dealResult.rows[0];
      if (!deal) {
        throw new Error('Deal not found');
      }

      await CreativeService.requestRevision(dealId, notes);

      const updateResult = await client.query(
        `UPDATE deals 
         SET status = 'negotiating', updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING *`,
        [dealId]
      );

      if (updateResult.rows.length === 0) {
        throw new Error(`Deal #${dealId} not found`);
      }

      await client.query(
        `INSERT INTO deal_messages (deal_id, sender_id, message_text)
         VALUES ($1, $2, $3)`,
        [dealId, requestedBy, `Revision requested: ${notes}`]
      );

      return updateResult.rows[0];
    });
  }

  /**
   * Create deal with brief message
   */
  static async createDealWithBrief(data: {
    deal_type: 'listing' | 'campaign';
    listing_id?: number;
    campaign_id?: number;
    channel_id: number;
    channel_owner_id: number;
    advertiser_id: number;
    ad_format: string;
    price_ton: number;
    timeout_hours?: number;
    briefText: string;
  }): Promise<any> {
    return await withTx(async (client) => {
      const timeoutHours = data.timeout_hours || 72;
      const timeoutAt = new Date();
      timeoutAt.setUTCHours(timeoutAt.getUTCHours() + timeoutHours);
      const utcTimeoutAt = new Date(timeoutAt.toISOString());

      const dealResult = await client.query(
        `INSERT INTO deals (
          deal_type, listing_id, campaign_id, channel_id, channel_owner_id,
          advertiser_id, ad_format, price_ton, timeout_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *`,
        [
          data.deal_type,
          data.listing_id,
          data.campaign_id,
          data.channel_id,
          data.channel_owner_id,
          data.advertiser_id,
          data.ad_format,
          data.price_ton,
          utcTimeoutAt,
        ]
      );

      const deal = dealResult.rows[0];

      await client.query(
        `INSERT INTO deal_messages (deal_id, sender_id, message_text)
         VALUES ($1, $2, $3)`,
        [deal.id, data.advertiser_id, data.briefText]
      );

      return deal;
    });
  }

  /**
   * Publish post for deal
   */
  static async publishPost(dealId: number, channelOwnerId: number): Promise<{
    messageId: number;
    postLink: string;
  }> {
    const deal = await DealModel.findById(dealId);
    if (!deal) {
      throw new Error('Deal not found');
    }

    if (deal.channel_owner_id !== channelOwnerId) {
      throw new Error('Unauthorized');
    }

    if (deal.status !== 'paid') {
      throw new Error(`Cannot publish post in status: ${deal.status}`);
    }

    const postText = await PostService.getPostTextFromDeal(dealId);
    const result = await PostService.preparePublishPost(dealId, deal.channel_id, postText);

    return result;
  }

  /**
   * Confirm publication and release funds
   * Uses distributed lock + transaction with FOR UPDATE lock to prevent race conditions
   * Includes idempotency check to prevent double releases
   */
  static async confirmPublication(dealId: number, advertiserId: number): Promise<{
    txHash: string;
  }> {
    return await distributedLock.withLock(
      dealId,
      'release_funds',
      async () => {
        return await withTx(async (client) => {
          const dealCheck = await client.query(
            `SELECT * FROM deals WHERE id = $1 FOR UPDATE`,
            [dealId]
          );

          if (dealCheck.rows.length === 0) {
            throw new Error('Deal not found');
          }

          const deal = dealCheck.rows[0];

          if (deal.advertiser_id !== advertiserId) {
            throw new Error('Unauthorized');
          }

          if (deal.status !== 'verified') {
            throw new Error(`Deal is not in verified status. Current status: ${deal.status}`);
          }

          if (deal.status === 'completed' && deal.payment_tx_hash) {
            logger.info(`Funds already released for Deal #${dealId}`, {
              dealId,
              existingTxHash: deal.payment_tx_hash,
            });
            return { txHash: deal.payment_tx_hash };
          }

          if (!deal.escrow_address || !deal.channel_owner_wallet_address) {
            throw new Error('Escrow address or channel owner wallet address not set');
          }

          if (!deal.post_message_id || !deal.channel_id) {
            throw new Error('Post information is missing');
          }

          const hasAccess = await PostService.verifyChannelAccess(deal.channel_id);
          if (!hasAccess) {
            throw new Error('Cannot verify channel access. The bot cannot access the channel.');
          }

          // Release funds BEFORE updating status (if release fails, status stays verified)
          // Pass checkIdempotency=false since we already checked above
          const txHash = await TONService.releaseFunds(
            dealId,
            deal.channel_owner_wallet_address,
            deal.price_ton.toString(),
            `Payment for Deal #${dealId}`,
            false // Already checked idempotency above
          );

          // Update status and record tx hash atomically
          // Note: We update payment_tx_hash with the release tx hash when completing the deal
          const updateResult = await client.query(
            `UPDATE deals 
             SET status = 'completed', payment_tx_hash = $1, updated_at = CURRENT_TIMESTAMP
             WHERE id = $2 AND status = 'verified' AND status != 'completed'
             RETURNING *`,
            [txHash, dealId]
          );

          if (updateResult.rows.length === 0) {
            // Another process released funds between our check and update
            // Re-query to get the existing tx hash
            const recheck = await client.query(
              `SELECT payment_tx_hash, status FROM deals WHERE id = $1`,
              [dealId]
            );
            if (recheck.rows.length > 0 && recheck.rows[0].status === 'completed' && recheck.rows[0].payment_tx_hash) {
              logger.warn(`Funds were released by another process for Deal #${dealId}`, {
                dealId,
                existingTxHash: recheck.rows[0].payment_tx_hash,
              });
              return { txHash: recheck.rows[0].payment_tx_hash };
            }
            throw new Error('Failed to update deal status. Funds may have been released by another process.');
          }

          return { txHash };
        });
      },
      { ttl: 60000 }
    );
  }

  /**
   * Decline deal
   */
  static async declineDeal(dealId: number, channelOwnerId: number): Promise<any> {
    return await withTx(async (client) => {
      const dealResult = await client.query(
        `SELECT * FROM deals WHERE id = $1 FOR UPDATE`,
        [dealId]
      );

      const deal = dealResult.rows[0];
      if (!deal || deal.channel_owner_id !== channelOwnerId) {
        throw new Error('Deal not found or unauthorized');
      }

      await client.query(
        `UPDATE deals 
         SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND status = 'pending'
         RETURNING *`,
        [dealId]
      );

      await client.query(
        `INSERT INTO deal_messages (deal_id, sender_id, message_text)
         VALUES ($1, $2, $3)`,
        [dealId, channelOwnerId, 'Deal declined by channel owner']
      );

      return dealResult.rows[0];
    });
  }

  /**
   * Send deal to draft with comment
   */
  static async sendToDraft(dealId: number, channelOwnerId: number, commentText: string): Promise<any> {
    return await withTx(async (client) => {
      const dealResult = await client.query(
        `SELECT * FROM deals WHERE id = $1 FOR UPDATE`,
        [dealId]
      );

      const deal = dealResult.rows[0];
      if (!deal || deal.channel_owner_id !== channelOwnerId) {
        throw new Error('Deal not found or unauthorized');
      }

      if (deal.status !== 'pending') {
        throw new Error(`Cannot send to draft in status: ${deal.status}`);
      }

      await client.query(
        `UPDATE deals 
         SET status = 'negotiating', updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND status = 'pending'
         RETURNING *`,
        [dealId]
      );

      await client.query(
        `INSERT INTO deal_messages (deal_id, sender_id, message_text)
         VALUES ($1, $2, $3)`,
        [dealId, channelOwnerId, `📝 Draft feedback: ${commentText}`]
      );

      return dealResult.rows[0];
    });
  }

  /**
   * Add message to deal
   */
  static async addDealMessage(dealId: number, senderId: number, messageText: string): Promise<void> {
    const deal = await DealModel.findById(dealId);
    if (!deal) {
      throw new Error('Deal not found');
    }

    if (deal.channel_owner_id !== senderId && deal.advertiser_id !== senderId) {
      throw new Error('Unauthorized');
    }

    await db.query(
      `INSERT INTO deal_messages (deal_id, sender_id, message_text)
       VALUES ($1, $2, $3)`,
      [dealId, senderId, messageText]
    );
  }

  /**
   * Get channel info for deal
   */
  static async getChannelInfoForDeal(dealId: number): Promise<{
    channelId: number;
    channelName: string;
    channelUsername?: string;
    telegramChannelId?: number;
  }> {
    const deal = await DealModel.findById(dealId);
    if (!deal) {
      throw new Error('Deal not found');
    }

    const channelResult = await db.query(
      'SELECT id, title, username, telegram_channel_id FROM channels WHERE id = $1',
      [deal.channel_id]
    );

    if (channelResult.rows.length === 0) {
      throw new Error('Channel not found');
    }

    const channel = channelResult.rows[0];
    return {
      channelId: channel.id,
      channelName: channel.title || channel.username || `Channel #${channel.id}`,
      channelUsername: channel.username,
      telegramChannelId: channel.telegram_channel_id,
    };
  }

  /**
   * Find deal requests for a channel owner by Telegram ID
   * Returns deals extended with channel info as nested channel field
   */
  static async findDealRequestByTelegramId(telegramId: number, limit: number = 20): Promise<any[]> {
    const user = await UserModel.findByTelegramId(telegramId);
    if (!user) {
      throw new Error('User not found');
    }

    const deals = await DealRepository.findPendingForChannelOwner(user.id, limit);

    if (deals.length === 0) {
      return [];
    }

    const channelIds = deals.map(deal => deal.channel_id);
    const dealIds = deals.map(deal => deal.id);

    const channelsMap = await ChannelRepository.findBasicInfoByIds(channelIds);
    const briefsMap = await DealRepository.findBriefsByDealIds(dealIds);

    return deals.map(deal => {
      const channel = channelsMap.get(deal.channel_id);
      const briefText = briefsMap.get(deal.id) || null;

      const isOwner = deal.channel_owner_id === user.id;

      return {
        ...deal,
        channel: channel ? { ...channel, owner: isOwner } : null,
        brief: briefText,
      };
    });
  }
  //
  // /**
  //  * Verify post and release funds
  //  */
  // static async verifyAndRelease(dealId: number): Promise<any> {
  //   const deal = await DealModel.findById(dealId);
  //   if (!deal) {
  //     throw new Error('Deal not found');
  //   }
  //
  //   if (!deal.escrow_address || !deal.channel_owner_wallet_address) {
  //     throw new Error('Escrow or recipient address not set');
  //   }
  //
  //   // TODO Verify post exists (simplified for MVP)
  //   const verified = true; // Would check actual post in production
  //
  //   if (verified) {
  //     // Release funds to channel owner
  //     await TONService.releaseFunds(
  //       dealId,
  //       deal.channel_owner_wallet_address!,
  //       deal.price_ton.toString(),
  //       `Payment for Deal #${dealId}`
  //     );
  //
  //     await DealModel.updateStatus(dealId, 'completed');
  //   } else {
  //     // Refund to advertiser
  //     // Would need advertiser address in production
  //     await DealModel.updateStatus(dealId, 'refunded');
  //   }
  //
  //   return await DealModel.findById(dealId);
  // }
}
