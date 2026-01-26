import { DealModel } from '../models/Deal';
import { TelegramService } from './telegram';
import db from '../db/connection';
import logger from '../utils/logger';
import { env } from '../utils/env';

export class PostService {
  /**
   * Publish post to channel
   * Returns post link and message ID
   */
  static async publishPost(dealId: number, channelId: number, postText: string): Promise<{
    messageId: number;
    postLink: string;
  }> {
    try {
      const deal = await DealModel.findById(dealId);
      if (!deal) {
        throw new Error('Deal not found');
      }

      if (deal.status !== 'paid') {
        throw new Error(`Cannot publish post in status: ${deal.status}`);
      }

      // Get channel info
      const channel = await db.query(
        'SELECT telegram_channel_id, username FROM channels WHERE id = $1',
        [channelId]
      );

      if (channel.rows.length === 0) {
        throw new Error('Channel not found');
      }

      const telegramChannelId = channel.rows[0].telegram_channel_id;
      const channelUsername = channel.rows[0].username;

      // Publish post to channel
      const sentMessage = await TelegramService.bot.sendMessage(
        telegramChannelId,
        postText
      );

      const messageId = sentMessage.message_id;

      if (!messageId) {
        throw new Error('Failed to get message ID from published post');
      }

      // Calculate verification until date
      const minPostDurationHours = parseInt(String(env.MIN_POST_DURATION_HOURS || '24'), 10);
      const verificationUntil = new Date();
      verificationUntil.setUTCHours(verificationUntil.getUTCHours() + minPostDurationHours);

      // Record post in database
      await DealModel.recordPost(deal.id, messageId, verificationUntil);
      await DealModel.updateStatus(deal.id, 'posted');

      // Build post link
      const postLink = this.buildPostLink(channelUsername, telegramChannelId, messageId);

      logger.info(`Post published for Deal #${dealId}`, {
        dealId,
        channelId,
        messageId,
        postLink,
      });

      return {
        messageId,
        postLink,
      };
    } catch (error: any) {
      logger.error(`Error publishing post for Deal #${dealId}`, {
        dealId,
        channelId,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Get post text from deal messages (brief)
   */
  static async getPostTextFromDeal(dealId: number): Promise<string> {
    const messages = await db.query(
      `SELECT message_text FROM deal_messages 
       WHERE deal_id = $1 
       ORDER BY created_at ASC 
       LIMIT 1`,
      [dealId]
    );

    if (messages.rows.length === 0) {
      throw new Error('No brief found in deal messages');
    }

    return messages.rows[0].message_text;
  }

  /**
   * Build Telegram post link
   */
  static buildPostLink(channelUsername: string | null, telegramChannelId: number, messageId: number): string {
    if (channelUsername) {
      return `https://t.me/${channelUsername.replace('@', '')}/${messageId}`;
    } else if (telegramChannelId) {
      // Convert channel ID format: -1001234567890 -> 1234567890
      const channelIdStr = telegramChannelId.toString().replace('-100', '');
      return `https://t.me/c/${channelIdStr}/${messageId}`;
    }
    return '';
  }

  /**
   * Verify bot has access to channel
   */
  static async verifyChannelAccess(channelId: number): Promise<boolean> {
    try {
      const channel = await db.query(
        'SELECT telegram_channel_id FROM channels WHERE id = $1',
        [channelId]
      );

      if (channel.rows.length === 0) {
        return false;
      }

      const telegramChannelId = channel.rows[0].telegram_channel_id;
      const botInfo = await TelegramService.bot.getMe();
      await TelegramService.bot.getChatMember(telegramChannelId, botInfo.id);
      return true;
    } catch (error: any) {
      logger.warn(`Cannot verify channel access`, {
        channelId,
        error: error.message,
      });
      return false;
    }
  }
}
