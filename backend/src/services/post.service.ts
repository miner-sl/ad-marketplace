import {TelegramService} from './telegram.service';
import db from '../db/connection';
import logger from '../utils/logger';
import {env} from '../utils/env';
import {withTx} from '../utils/transaction';
import {distributedLock} from '../utils/lock';

const minPostDurationHours = parseInt(String(env.MIN_POST_DURATION_HOURS || '24'), 10);

export type PublishedPost = {
  messageId: number;
  postLink: string;
};

export class PostService {
  /**
   * Publish post to channel
   * Returns post link and message ID
   * Uses distributed lock + FOR UPDATE lock to prevent race conditions between manual and auto-publish
   */
  static async preparePublishPost(dealId: number, channelId: number, postText: string): Promise<PublishedPost> {
    return await distributedLock.withLock(
      dealId,
      'publish_post',
      async () => {
        return await withTx(async (client) => {
          try {
            const dealResult = await client.query(
              `SELECT * FROM deals WHERE id = $1 FOR UPDATE`,
              [dealId]
            );

            if (dealResult.rows.length === 0) {
              throw new Error('Deal not found');
            }

            const deal = dealResult.rows[0];

            if (deal.status === 'posted' && deal.post_message_id) {
              logger.info(`Post already published for Deal #${dealId}`, {
                dealId,
                existingMessageId: deal.post_message_id,
                currentStatus: deal.status,
              });
              const channel = await client.query(
                'SELECT telegram_channel_id, username FROM channels WHERE id = $1',
                [channelId]
              );

              if (channel.rows.length === 0) {
                throw new Error('Channel not found');
              }

              const telegramChannelId = channel.rows[0].telegram_channel_id;
              const channelUsername = channel.rows[0].username;
              const postLink = this.buildPostLink(channelUsername, telegramChannelId, deal.post_message_id);

              return {
                messageId: deal.post_message_id,
                postLink,
              };
            }

            const allowedStatuses = ['paid', 'scheduled', 'creative_approved'];
            if (!allowedStatuses.includes(deal.status)) {
              throw new Error(`Cannot publish post in status: ${deal.status}`);
            }

            const channel = await client.query(
              'SELECT telegram_channel_id, username FROM channels WHERE id = $1',
              [channelId]
            );

            if (channel.rows.length === 0) {
              throw new Error('Channel not found');
            }

            const telegramChannelId = channel.rows[0].telegram_channel_id;
            const channelUsername = channel.rows[0].username;

            const sentMessage = await TelegramService.postToChannel(
              telegramChannelId,
              {text: postText}
            );

            const messageId = sentMessage.message_id;

            if (!messageId) {
              throw new Error('Failed to get message ID from published post');
            }

            const verificationUntil = new Date();
            verificationUntil.setUTCHours(verificationUntil.getUTCHours() + minPostDurationHours);

            // Record post in database (this also updates status to 'posted')
            // Use the transaction client to ensure atomicity
            const verificationUntilUtc = new Date(verificationUntil.toISOString());
            const recordResult = await client.query(
              `UPDATE deals 
           SET status = 'posted', actual_post_time = CURRENT_TIMESTAMP, 
               post_message_id = $1, post_verification_until = $2 AT TIME ZONE 'UTC', updated_at = CURRENT_TIMESTAMP
           WHERE id = $3 AND status IN ('paid', 'scheduled', 'creative_approved')
           RETURNING *`,
              [messageId, verificationUntilUtc, dealId]
            );

            if (recordResult.rows.length === 0) {
              // Status changed during publish - another process may have published
              // Re-check to see if it was published
              const recheck = await client.query(
                `SELECT * FROM deals WHERE id = $1`,
                [dealId]
              );
              if (recheck.rows.length > 0 && recheck.rows[0].post_message_id) {
                logger.info(`Post was published by another process for Deal #${dealId}`, {
                  dealId,
                  existingMessageId: recheck.rows[0].post_message_id,
                });
                const postLink = this.buildPostLink(channelUsername, telegramChannelId, recheck.rows[0].post_message_id);
                return {
                  messageId: recheck.rows[0].post_message_id,
                  postLink,
                };
              }
              throw new Error(`Deal #${dealId} status changed during post publication`);
            }

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
        });
      },
      {ttl: 30000}
    );
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
