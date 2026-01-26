import { UserModel } from '../models/User';
import { TelegramService } from './telegram';
import logger from '../utils/logger';

export interface NotificationData {
  dealId: number;
  channelId?: number;
  channelName?: string;
  priceTon?: number;
  adFormat?: string;
  postLink?: string;
  txHash?: string;
  escrowAddress?: string;
  channelOwnerWalletAddress?: string;
  briefPreview?: string;
  commentText?: string;
}

export class NotificationService {
  /**
   * Notify advertiser about payment invoice after deal acceptance
   */
  static async notifyPaymentInvoice(dealId: number, advertiserId: number, data: NotificationData): Promise<void> {
    try {
      const advertiser = await UserModel.findById(advertiserId);
      if (!advertiser) {
        logger.warn(`Advertiser #${advertiserId} not found for payment invoice notification`);
        return;
      }

      const invoiceMessage = 
        `💰 Payment Invoice for Deal #${dealId}\n\n` +
        (data.channelName ? `Channel: ${data.channelName}\n` : `Channel: #${data.channelId}\n`) +
        (data.adFormat ? `Format: ${data.adFormat}\n` : '') +
        (data.priceTon ? `Amount: ${data.priceTon} TON\n\n` : '') +
        (data.priceTon ? `Please send ${data.priceTon} TON to the escrow address:\n\n` : '') +
        (data.escrowAddress ? `\`${data.escrowAddress}\`\n\n` : '') +
        `After sending payment, click "✅ Confirm Payment" below.\n\n` +
        `This is a system-managed escrow wallet. Funds will be held until the post is published and verified.`;

      const invoiceButtons = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '💳 Copy Escrow Address', callback_data: `copy_escrow_${dealId}` },
              { text: '📋 View Deal Details', callback_data: `deal_details_${dealId}` }
            ],
            [
              { text: '✅ Confirm Payment', callback_data: `confirm_payment_${dealId}` }
            ]
          ]
        }
      };

      await TelegramService.bot.sendMessage(advertiser.telegram_id, invoiceMessage, invoiceButtons);
    } catch (error: any) {
      logger.error(`Error sending payment invoice notification`, {
        dealId,
        advertiserId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Notify channel owner about new ad request
   */
  static async notifyNewAdRequest(dealId: number, channelOwnerId: number, data: NotificationData): Promise<void> {
    try {
      const channelOwner = await UserModel.findById(channelOwnerId);
      if (!channelOwner) {
        logger.warn(`Channel owner #${channelOwnerId} not found for new request notification`);
        return;
      }

      const notificationMessage = 
        `📨 New Ad Request for Deal #${dealId}!\n\n` +
        (data.channelName ? `📺 Channel: ${data.channelName}\n` : '') +
        (data.priceTon ? `💰 Price: ${data.priceTon} TON\n` : '') +
        (data.adFormat ? `📝 Format: ${data.adFormat}\n\n` : '') +
        (data.briefPreview ? `📄 Brief:\n${data.briefPreview}\n\n` : '') +
        `Please review and accept or decline the request.`;

      const notificationButtons = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Accept', callback_data: `accept_request_${dealId}` },
              { text: '❌ Decline', callback_data: `decline_request_${dealId}` }
            ],
            [
              { text: '📝 Send to Draft', callback_data: `send_to_draft_${dealId}` }
            ],
            [
              { text: '📋 View Deal', callback_data: `deal_details_${dealId}` }
            ]
          ]
        }
      };

      await TelegramService.bot.sendMessage(
        channelOwner.telegram_id,
        notificationMessage,
        notificationButtons
      );
    } catch (error: any) {
      logger.error(`Error sending new ad request notification`, {
        dealId,
        channelOwnerId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Notify advertiser about deal decline
   */
  static async notifyDealDeclined(dealId: number, advertiserId: number, data: NotificationData): Promise<void> {
    try {
      const advertiser = await UserModel.findById(advertiserId);
      if (!advertiser) {
        logger.warn(`Advertiser #${advertiserId} not found for decline notification`);
        return;
      }

      const notificationMessage = 
        `❌ Deal #${dealId} Declined\n\n` +
        `The channel owner has declined your ad request.\n\n` +
        (data.channelName ? `📺 Channel: ${data.channelName}\n` : '') +
        (data.priceTon ? `💰 Price: ${data.priceTon} TON\n` : '') +
        (data.adFormat ? `📝 Format: ${data.adFormat}\n\n` : '') +
        `You can browse other channels or create a new request.\n\n` +
        `Use /deal ${dealId} to view details.`;

      const notificationButtons = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '📋 View Deal', callback_data: `deal_details_${dealId}` },
              { text: '📺 Browse Channels', callback_data: 'browse_channels' }
            ]
          ]
        }
      };

      await TelegramService.bot.sendMessage(
        advertiser.telegram_id,
        notificationMessage,
        notificationButtons
      );
    } catch (error: any) {
      logger.error(`Error sending deal declined notification`, {
        dealId,
        advertiserId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Notify channel owner about payment received
   */
  static async notifyPaymentReceived(dealId: number, channelOwnerId: number, priceTon: number): Promise<void> {
    try {
      const channelOwner = await UserModel.findById(channelOwnerId);
      if (!channelOwner) {
        logger.warn(`Channel owner #${channelOwnerId} not found for payment notification`);
        return;
      }

      const ownerNotificationButtons = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '📋 View Deal', callback_data: `deal_details_${dealId}` }
            ]
          ]
        }
      };

      await TelegramService.bot.sendMessage(
        channelOwner.telegram_id,
        `✅ Payment received for Deal #${dealId}!\n\n` +
        `Amount: ${priceTon} TON\n` +
        `You can now publish the post.\n\n` +
        `Use the button below to view deal details.`,
        ownerNotificationButtons
      );
    } catch (error: any) {
      logger.error(`Error sending payment received notification`, {
        dealId,
        channelOwnerId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Notify advertiser about creative submitted
   */
  static async notifyCreativeSubmitted(dealId: number, advertiserId: number): Promise<void> {
    try {
      const advertiser = await UserModel.findById(advertiserId);
      if (!advertiser) {
        logger.warn(`Advertiser #${advertiserId} not found for creative submitted notification`);
        return;
      }

      await TelegramService.bot.sendMessage(
        advertiser.telegram_id,
        `📝 Creative submitted for Deal #${dealId}!\n\n` +
        `Please review and approve or request revisions.\n\n` +
        `Use /deal ${dealId} to view details.`
      );
    } catch (error: any) {
      logger.error(`Error sending creative submitted notification`, {
        dealId,
        advertiserId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Notify channel owner about creative approved
   */
  static async notifyCreativeApproved(dealId: number, channelOwnerId: number): Promise<void> {
    try {
      const channelOwner = await UserModel.findById(channelOwnerId);
      if (!channelOwner) {
        logger.warn(`Channel owner #${channelOwnerId} not found for creative approved notification`);
        return;
      }

      await TelegramService.bot.sendMessage(
        channelOwner.telegram_id,
        `✅ Creative approved for Deal #${dealId}!\n\n` +
        `You can now publish the post.\n\n` +
        `Use /deal ${dealId} to view details.`
      );
    } catch (error: any) {
      logger.error(`Error sending creative approved notification`, {
        dealId,
        channelOwnerId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Notify advertiser about post published
   */
  static async notifyPostPublished(dealId: number, advertiserId: number, postLink?: string): Promise<void> {
    try {
      const advertiser = await UserModel.findById(advertiserId);
      if (!advertiser) {
        logger.warn(`Advertiser #${advertiserId} not found for post published notification`);
        return;
      }

      const confirmMessage = 
        `📤 Post Published for Deal #${dealId}!\n\n` +
        `The channel owner has published the post.\n\n` +
        (postLink ? `🔗 View Post: <a href="${postLink}">Click here</a>\n\n` : '') +
        `Please verify that the post is visible in the channel and click "✅ Confirm Publication" below.\n\n` +
        `After your confirmation, funds will be released to the channel owner.\n\n` +
        `Use /deal ${dealId} to view details.`;

      const confirmButtons = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Confirm Publication', callback_data: `confirm_publication_${dealId}` }
            ],
            [
              { text: '📋 View Deal', callback_data: `deal_details_${dealId}` }
            ]
          ]
        },
        parse_mode: 'HTML' as const
      };

      await TelegramService.bot.sendMessage(advertiser.telegram_id, confirmMessage, confirmButtons);
    } catch (error: any) {
      logger.error(`Error sending post published notification`, {
        dealId,
        advertiserId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Notify advertiser about deal sent to draft
   */
  static async notifyDealSentToDraft(dealId: number, advertiserId: number, commentText: string): Promise<void> {
    try {
      const advertiser = await UserModel.findById(advertiserId);
      if (!advertiser) {
        logger.warn(`Advertiser #${advertiserId} not found for draft notification`);
        return;
      }

      const notificationMessage = 
        `📝 Deal #${dealId} Sent to Draft\n\n` +
        `The channel owner has sent your request back for revision.\n\n` +
        `💬 Feedback:\n${commentText}\n\n` +
        `Please review the feedback and update your brief if needed.\n\n` +
        `Use /deal ${dealId} to view details and edit your brief.`;

      const notificationButtons = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '📋 View Deal', callback_data: `deal_details_${dealId}` }
            ]
          ]
        }
      };

      await TelegramService.bot.sendMessage(
        advertiser.telegram_id,
        notificationMessage,
        notificationButtons
      );
    } catch (error: any) {
      logger.error(`Error sending draft notification`, {
        dealId,
        advertiserId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Notify channel owner about deal completion and fund release
   */
  static async notifyDealCompleted(dealId: number, channelOwnerId: number, data: NotificationData): Promise<void> {
    try {
      const channelOwner = await UserModel.findById(channelOwnerId);
      if (!channelOwner) {
        logger.warn(`Channel owner #${channelOwnerId} not found for completion notification`);
        return;
      }

      await TelegramService.bot.sendMessage(
        channelOwner.telegram_id,
        `✅ Deal #${dealId} Completed!\n\n` +
        `The advertiser has confirmed publication.\n` +
        `Post verification period completed and post verified.\n` +
        (data.priceTon ? `Funds (${data.priceTon} TON) have been released to your wallet:\n` : '') +
        (data.channelOwnerWalletAddress ? `\`${data.channelOwnerWalletAddress}\`\n\n` : '') +
        (data.txHash ? `Transaction: ${data.txHash}\n\n` : '') +
        `Use /deal ${dealId} to view details.`,
        { parse_mode: 'Markdown' }
      );
    } catch (error: any) {
      logger.error(`Error sending deal completed notification`, {
        dealId,
        channelOwnerId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Send message to other party in deal
   */
  static async notifyDealMessage(dealId: number, senderId: number, recipientId: number, messageText: string): Promise<void> {
    try {
      const recipient = await UserModel.findById(recipientId);
      if (!recipient) {
        logger.warn(`Recipient #${recipientId} not found for deal message notification`);
        return;
      }

      await TelegramService.bot.sendMessage(
        recipient.telegram_id,
        `💬 New message in Deal #${dealId}:\n\n${messageText}\n\nUse /deal ${dealId} to view.`
      );
    } catch (error: any) {
      logger.error(`Error sending deal message notification`, {
        dealId,
        senderId,
        recipientId,
        error: error.message,
      });
      throw error;
    }
  }
}
