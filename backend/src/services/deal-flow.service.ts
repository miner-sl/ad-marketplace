import {Address} from "@ton/core";

import {DealModel} from '../repositories/deal-model.repository';
import {ChannelModel} from '../repositories/channel-model.repository';
import {UserModel} from '../repositories/user.repository';
import {TONService} from './ton.service';
import {CreativeService} from './creative.service';
import {CreativeRepository} from '../repositories/creative.repository';
import {PostService} from './post.service';
import {TelegramNotificationQueueService} from './telegram-notification-queue.service';
import {DealRepository} from '../repositories/deal.repository';
import {ChannelRepository} from '../repositories/channel.repository';
import {TelegramService} from './telegram.service';
import {TelegramNotificationService} from './telegram-notification.service';

import {withTx} from '../utils/transaction';
import logger from '../utils/logger';
import {distributedLock} from '../utils/lock';
import {Deal} from '../models/deal.types';
import env from '../utils/env';
import {generateUserIDHash} from "../utils/verifyTonProof";
import getRedisClient from "../utils/redis";

/**
 * DTO for submitting payment
 */
export interface SubmitPaymentDto {
  dealId: number;
  userId: number;
  wallet?: string;
  boc?: string;
}

/**
 * Result of payment submission
 */
export interface SubmitPaymentResult {
  processed: boolean;
  message: string;
}

export class DealFlowService {
  static async findDeals(userId: number, status?: string, dealType?: string, limit?: number) {
    let deals;

    if (userId) {
      const user = await UserModel.findById(userId);
      if (!user) {
        return {
          ok: false,
          error: 'User not found'
        }
      }
      deals = await DealModel.findByUser(user.id, status as string | undefined);
    } else {
      deals = await DealRepository.listDealsWithFilters({
        status: status as string | undefined,
        deal_type: dealType as string | undefined,
        limit: (limit as unknown as number) || 20,
      });
    }

    return {
      ok: true,
      // @ts-ignore
      data: deals.map((deal) => ({...deal, price_ton: parseInt(deal.price_ton) })),
    };
  }
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
    publish_date?: Date;
    postText?: string;
  }): Promise<any> {
    return await withTx(async (client) => {
      const channel = await ChannelRepository.findByIdWithClient(client, data.channel_id);
      if (!channel) {
        throw new Error(`Channel with id ${data.channel_id} not found`);
      }

      if (channel.owner_id !== data.channel_owner_id) {
        throw new Error(`Channel owner mismatch. Channel ${data.channel_id} is owned by user ${channel.owner_id}, not ${data.channel_owner_id}`);
      }

      const advertiser = await UserModel.findByTelegramIdWithClient(client, data.advertiser_id);
      if (!advertiser) {
        throw new Error(`User with telegram_id ${data.advertiser_id} not found. Please register first.`);
      }

      const deal = await DealModel.createWithClient(client, {
        deal_type: data.deal_type,
        listing_id: data.listing_id,
        campaign_id: data.campaign_id,
        channel_id: data.channel_id,
        channel_owner_id: data.channel_owner_id,
        advertiser_id: advertiser.id,
        ad_format: data.ad_format,
        price_ton: data.price_ton,
        scheduled_post_time: data.publish_date,
      });

      if (data.postText) {
        await DealRepository.addMessageWithClient(client, deal.id, advertiser.id, data.postText);

        await CreativeService.createWithClient(client, {
          deal_id: deal.id,
          submitted_by: advertiser.id,
          content_type: 'text',
          content_data: { text: data.postText }
        });
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
  static async acceptDeal(dealId: number, telegramUserId: number): Promise<Deal> {
    return await withTx(async (client) => {
      const channelOwner = await UserModel.findByTelegramId(telegramUserId)
      if (!channelOwner) {
        throw new Error('User not have access to this deal');
      }
      const deal = await DealModel.findByIdForUpdate(client, dealId);
      if (!deal || deal.channel_owner_id !== channelOwner.id) {
        throw new Error('Deal not found or unauthorized');
      }

      const channel = await ChannelRepository.findById(deal.channel_id);
      if (!channel || !channel.telegram_channel_id) {
        throw new Error('Channel not found');
      }

      const channelAdmins = await TelegramService.getChannelAdmins(channel?.telegram_channel_id);
      const isChannelAdmin = channelAdmins.find((admin) => String(admin.user.id) === String(telegramUserId));
      if (!isChannelAdmin) {
        throw new Error('You are not an admin of this channel');
      }

      if (telegramUserId) {
        const isAdmin = await ChannelModel.verifyAdminStatus(
          deal.channel_id,
          channelOwner.id,
          channelOwner.telegram_id
        );
        if (!isAdmin) {
          throw new Error('You are no longer an admin of this channel');
        }
      }

      if (deal.status !== 'pending' && deal.status !== 'negotiating') {
        throw new Error(`Cannot accept deal in status: ${deal.status}`);
      }

      const ownerWalletAddress = channelOwner.wallet_address;
      if (!ownerWalletAddress) {
        throw new Error('Channel owner wallet address not set. Please set your wallet address first.');
      }

      const updatedDeal = await DealModel.updateStatusWithClient(client, dealId, 'payment_pending');
      return updatedDeal;
    });
  }

  /**
   * Accept deal and send payment invoice notification if escrow address exists
   */
  static async acceptDealWithNotify(dealId: number, telegramUserId: number): Promise<Deal> {
    const deal = await this.acceptDeal(dealId, telegramUserId);

    // Send notification if escrow address exists and deal is in payment_pending status
    if (deal && deal.escrow_address !== null && deal.status === 'payment_pending') {
      try {
        const channelInfo = await ChannelRepository.getBasicInfo(deal.channel_id);
        const channelName = channelInfo?.title || channelInfo?.username || `Channel #${deal.channel_id}`;

        await TelegramNotificationService.notifyPaymentInvoice(
          deal.id,
          deal.advertiser_id,
          {
            dealId: deal.id,
            channelId: deal.channel_id,
            channelName: channelName,
            priceTon: parseFloat(deal.price_ton.toString()),
            adFormat: deal.ad_format,
            escrowAddress: deal.escrow_address,
          }
        );

        logger.info(`Payment invoice notification sent for Deal #${deal.id}`, {
          dealId: deal.id,
          advertiserId: deal.advertiser_id,
        });
      } catch (notifError: any) {
        // Log error but don't fail the deal acceptance if notification fails
        logger.warn('Failed to send payment invoice notification', {
          error: notifError.message,
          dealId: deal.id,
          stack: notifError.stack,
        });
      }
    }

    return deal;
  }

  static async generateEscrowAddress(deal: Deal, ownerWalletAddress: string): Promise<any> {
    const dealId = deal.id;
    if (deal.escrow_address !== null) {
      return deal;
    }

    if (!ownerWalletAddress) {
      throw new Error('Channel owner wallet address not set. Please set your wallet address first.');
    }
    const channel = await ChannelRepository.findById(deal.channel_id);
    if (!channel || !channel.telegram_channel_id) {
      throw new Error('Channel not found');
    }

    const channelAdmins = await TelegramService.getChannelAdmins(channel?.telegram_channel_id);
    const isChannelAdmin = channelAdmins.find((admin) => String(admin.user.username) === env.TELEGRAM_BOT_USERNAME);
    if (!isChannelAdmin) {
      await TelegramNotificationService.notifyAboutAddBotAsAdmin(deal, channel, channel.owner_id);
      throw new Error('You are not an admin of this channel');
    }

    const escrowAddress = await TONService.generateEscrowAddress(dealId);
    const updateDeal = await DealModel.updateEscrowAddress(escrowAddress, ownerWalletAddress, dealId);

    if (deal.status === 'payment_pending') {
      await TelegramNotificationService.notifyPaymentInvoice(
        dealId,
        deal.advertiser_id,
        {
          dealId: deal.id,
          channelId: deal.channel_id,
          channelName: channel.title,
          priceTon: parseFloat(deal.price_ton.toString()),
          adFormat: deal.ad_format,
          escrowAddress: deal.escrow_address,
        },
      );
    }
    return updateDeal;
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
          const deal = await DealModel.findByIdForUpdate(client, dealId);
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
          try {
            const updated = await DealModel.updateStatusAndPaymentWithClient(
              client,
              dealId,
              finalStatus,
              txHash,
              `status = 'payment_pending' AND payment_tx_hash IS NULL`
            );

            await DealRepository.addMessageWithClient(
              client,
              dealId,
              deal.advertiser_id,
              `Payment confirmed: ${txHash}`
            );

            return updated;
          } catch (error: any) {
            // Check if payment was confirmed by another process
            const recheck = await DealModel.findById(dealId);
            if (recheck && recheck.payment_tx_hash) {
              logger.info(`Payment was confirmed by another process for Deal #${dealId}`, {
                dealId,
                existingTxHash: recheck.payment_tx_hash,
              });
              return recheck;
            }
            throw new Error('Payment already confirmed or deal status changed');
          }
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
      const deal = await DealModel.findByIdForUpdate(client, dealId);
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

      const updated = await DealModel.updateStatusWithClient(
        client,
        dealId,
        'creative_submitted',
        `status = 'paid'`
      );

      return updated;
    });
  }

  /**
   * Advertiser approves creative
   */
  static async approveCreative(dealId: number, advertiserId: number): Promise<any> {
    return await withTx(async (client) => {
      const deal = await DealModel.findByIdForUpdate(client, dealId);
      if (!deal || deal.advertiser_id !== advertiserId) {
        throw new Error('Deal not found or unauthorized');
      }

      if (deal.status !== 'creative_submitted') {
        throw new Error(`Cannot approve creative in status: ${deal.status}`);
      }

      await CreativeService.approve(dealId);

      const finalStatus = deal.payment_confirmed_at ? 'paid' : 'creative_approved';

      const updated = await DealModel.updateStatusWithClient(
        client,
        dealId,
        finalStatus,
        `status = 'creative_submitted'`
      );

      await DealRepository.addMessageWithClient(
        client,
        dealId,
        advertiserId,
        'Creative approved'
      );

      return updated;
    });
  }

  /**
   * Request revision of creative
   * @param dealId - Deal ID
   * @param requestedBy - Telegram ID of the user requesting revision
   * @param notes - Revision notes
   */
  static async requestRevision(dealId: number, requestedBy: number, notes: string): Promise<any> {
    const deal = await withTx(async (client) => {
      const dealRecord = await DealModel.findByIdForUpdate(client, dealId);
      if (!dealRecord) {
        throw new Error('Deal not found');
      }

      const user = await UserModel.findById(requestedBy);
      if (!user) {
        throw new Error(`User with id ${requestedBy} not found. Please register first.`);
      }

      await CreativeService.requestRevisionWithClient(client, dealId, notes);

      const updated = await DealModel.updateToNegotiatingWithClient(client, dealId);

      await DealRepository.addMessageWithClient(
        client,
        dealId,
        user.id,
        `Revision: ${notes}`
      );

      return updated;
    });
    if (deal.status === 'negotiating') {
      await TelegramNotificationService.notifyRevisionRequested(deal, requestedBy, notes);
    }
    return deal;
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
    briefText: string;
  }): Promise<any> {
    return await withTx(async (client) => {
      const deal = await DealModel.createWithClient(client, {
        deal_type: data.deal_type,
        listing_id: data.listing_id,
        campaign_id: data.campaign_id,
        channel_id: data.channel_id,
        channel_owner_id: data.channel_owner_id,
        advertiser_id: data.advertiser_id,
        ad_format: data.ad_format,
        price_ton: data.price_ton,
      });

      await DealRepository.addMessageWithClient(
        client,
        deal.id,
        data.advertiser_id,
        data.briefText
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
          const deal = await DealModel.findByIdForUpdate(client, dealId);
          if (!deal) {
            throw new Error('Deal not found');
          }

          if (deal.advertiser_id !== advertiserId) {
            throw new Error('Unauthorized');
          }

          // Check if already completed first
          if (deal.status === 'completed' && deal.payment_tx_hash) {
            logger.info(`Funds already released for Deal #${dealId}`, {
              dealId,
              existingTxHash: deal.payment_tx_hash,
            });
            return { txHash: deal.payment_tx_hash };
          }

          // Then check if in verified status
          if (deal.status !== 'verified') {
            throw new Error(`Deal is not in verified status. Current status: ${deal.status}`);
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

          try {
            // Update status and record tx hash atomically
            await DealModel.updateToCompletedWithClient(client, dealId, txHash);
            return { txHash };
          } catch (error: any) {
            // Another process released funds between our check and update
            // Re-query to get the existing tx hash
            const recheck = await DealModel.findById(dealId);
            if (recheck && recheck.status === 'completed' && recheck.payment_tx_hash) {
              logger.warn(`Funds were released by another process for Deal #${dealId}`, {
                dealId,
                existingTxHash: recheck.payment_tx_hash,
              });
              return { txHash: recheck.payment_tx_hash };
            }
            throw new Error('Failed to update deal status. Funds may have been released by another process.');
          }
        });
      },
      { ttl: 60000 }
    );
  }

  static async declineDealWithNotification(dealId: number, channelOwnerId: number, reason?: string): Promise<any> {
    try {
      const deal = await this.declineDeal(dealId, channelOwnerId, reason);
      console.log({deal})
      const channelInfo = await DealFlowService.getChannelInfoForDeal(dealId);
      await TelegramNotificationService.notifyDealDeclined(dealId, deal.advertiser_id, {
        dealId: deal,
        channelId: channelInfo.channelId,
        channelName: channelInfo.channelName,
        priceTon: deal.price_ton,
        adFormat: deal.ad_format,
      });
    } catch (notifError: any) {
      // Log but don't fail if notification fails
      logger.warn('Failed to send decline notification', {
        error: notifError.message,
        dealId,
      });
    }
  }
  /**
   * Decline deal
   */
  static async declineDeal(dealId: number, channelOwnerId: number, reason?: string): Promise<any> {
    return await withTx(async (client) => {
      const deal = await DealModel.findByIdForUpdate(client, dealId);
      if (!deal || deal.channel_owner_id !== channelOwnerId) {
        throw new Error('Deal not found or unauthorized');
      }

      const updated = await DealModel.updateToDeclinedWithClient(client, dealId, reason);

      const messageText = reason
        ? `Deal declined by channel owner: ${reason}`
        : 'Deal declined by channel owner';

      await DealRepository.addMessageWithClient(
        client,
        dealId,
        channelOwnerId,
        messageText
      );

      return updated;
    });
  }

  /**
   * Send deal to draft with comment
   */
  static async sendToDraft(dealId: number, channelOwnerId: number, commentText: string): Promise<any> {
    return await withTx(async (client) => {
      const deal = await DealModel.findByIdForUpdate(client, dealId);
      if (!deal || deal.channel_owner_id !== channelOwnerId) {
        throw new Error('Deal not found or unauthorized');
      }

      if (deal.status !== 'pending') {
        throw new Error(`Cannot send to draft in status: ${deal.status}`);
      }

      const updated = await DealModel.updateToNegotiatingWithClient(
        client,
        dealId,
        `status = 'pending'`
      );

      await DealRepository.addMessageWithClient(
        client,
        dealId,
        channelOwnerId,
        `📝 Draft feedback: ${commentText}`
      );

      return updated;
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

    await withTx(async (client) => {
      await DealRepository.addMessageWithClient(client, dealId, senderId, messageText);
    });
  }

  /**
   * Update the most recent deal message sent by the user
   */
  static async updateDealMessage(dealId: number, senderId: number, messageText: string): Promise<any> {
    const deal = await DealModel.findById(dealId);
    if (!deal) {
      throw new Error('Deal not found');
    }

    if (deal.channel_owner_id !== senderId && deal.advertiser_id !== senderId) {
      throw new Error('Unauthorized');
    }

    return await withTx(async (client) => {
      const latestMessage = await DealRepository.findLatestMessageBySenderWithClient(
        client,
        dealId,
        senderId
      );

      if (!latestMessage) {
        await DealRepository.addMessageWithClient(client, dealId, senderId, messageText);
        return { message: 'Message created' };
      }

      const updatedMessage = await DealRepository.updateMessageWithClient(
        client,
        latestMessage.id,
        dealId,
        senderId,
        messageText
      );

      await DealRepository.updateDealStatusToPendingWithClient(client, dealId);

      const recipientId = deal.channel_owner_id === senderId
        ? deal.advertiser_id
        : deal.channel_owner_id;

      // Send notification to the other party about the message update
      try {
        const recipient = await UserModel.findById(recipientId);
        if (recipient) {
          await TelegramNotificationQueueService.queueTelegramMessage(
            recipient.telegram_id,
            `✏️ Message updated in Deal #${dealId}:\n\n${messageText}\n\nUse /deal ${dealId} to view.`
          );
        }
      } catch (error: any) {
        // Log error but don't fail the update if notification fails
        logger.warn('Failed to send notification for updated deal message', {
          dealId,
          senderId,
          recipientId,
          error: error.message,
        });
      }

      return updatedMessage;
    });
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

    const channel = await DealRepository.getChannelInfoForDeal(dealId);
    if (!channel) {
      throw new Error('Channel not found');
    }

    return {
      channelId: channel.id,
      channelName: channel.title || channel.username || `Channel #${channel.id}`,
      channelUsername: channel.username,
      telegramChannelId: channel.telegram_channel_id,
    };
  }

  /**
   * Get deal by ID with enriched data (messages, creative, advertiser info)
   * @param dealId - Deal ID
   * @param telegramUserId - Optional Telegram user ID to check ownership
   * @returns Enriched deal object with messages, creative, and advertiser info
   */
  static async getDealById(dealId: number, telegramUserId?: number): Promise<any> {
    const deal = await DealModel.findByIdWithChannel(dealId);
    if (!deal) {
      throw new Error('Deal not found');
    }

    let user = null;
    if (telegramUserId !== undefined && telegramUserId !== null) {
      const telegramId = typeof telegramUserId === 'string' ? Number(telegramUserId) : telegramUserId;
      if (!isNaN(telegramId)) {
        user = await UserModel.findByTelegramId(telegramId);
      }
    }

    const messages = await DealRepository.getMessages(deal.id);
    const creative = await CreativeRepository.findByDeal(deal.id);

    const advertiser = await UserModel.findById(deal.advertiser_id);
    const advertiserInfo = advertiser ? {
      id: advertiser.id,
      telegram_id: Number(advertiser.telegram_id),
      username: advertiser.username,
      first_name: advertiser.first_name,
      last_name: advertiser.last_name,
      is_channel_owner: advertiser.is_channel_owner,
      is_advertiser: advertiser.is_advertiser,
    } : null;

    const { channel_owner_wallet_address, ...dealWithoutWallet } = deal;

    return {
      ...dealWithoutWallet,
      postLink: deal.status === 'posted' ? PostService.buildPostLink(deal.channel_username, deal.telegram_channel_id, deal.message_id) : undefined,
      owner: user !== null ? user?.id === deal.channel_owner_id : false,
      advertiser: advertiserInfo,
      messages,
      creative,
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
  /**
   * Submit payment information for a deal
   * Stores payment data in Redis for verification
   */
  static async submitPayment(dto: SubmitPaymentDto): Promise<SubmitPaymentResult> {
    const deal = await DealModel.findById(dto.dealId);

    if (!deal) {
      throw new Error('Deal not found');
    }

    if (deal.status !== 'payment_pending') {
      throw new Error(`Deal is not in payment_pending status. Current status: ${deal.status}`);
    }

    if (deal.advertiser_id !== dto.userId) {
      throw new Error('Only the advertiser can submit payment for this deal');
    }

    const redis = getRedisClient();
    const paymentKey = `deal-payment-pending-${dto.dealId}`;
    const existingPayment = await redis.get(paymentKey);

    if (existingPayment) {
      logger.info(`Payment already submitted for Deal #${dto.dealId}`, {
        dealId: dto.dealId,
        userId: dto.userId,
      });
      return {
        processed: false,
        message: 'Payment submission already exists',
      };
    }

    if (deal.price_ton > 0) {
      const userHash = generateUserIDHash(dto.userId);
      const payload = `deal-${deal.id}-${userHash}`;

      const paymentData = {
        wallet: dto.wallet || '',
        wallet_raw: dto.wallet ? Address.parse(dto.wallet).toRawString() : '',
        boc: dto.boc || '',
        time: Date.now() / 1000,
        payload: payload,
      };

      await redis.set(
        paymentKey,
        JSON.stringify(paymentData),
        'EX',
        3600 // Expire after 1 hour
      );

      logger.info(`Payment submitted for Deal #${dto.dealId}`, {
        dealId: dto.dealId,
        userId: dto.userId,
        paymentKey,
        paymentData: { ...paymentData, wallet_raw: paymentData.wallet_raw.substring(0, 20) + '...' },
      });

      return {
        processed: false,
        message: 'Payment submitted and pending verification',
      };
    } else {
      logger.info(`Free deal payment processed immediately for Deal #${dto.dealId}`, {
        dealId: dto.dealId,
        userId: dto.userId,
      });

      return {
        processed: true,
        message: 'Payment processed (free deal)',
      };
    }
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
