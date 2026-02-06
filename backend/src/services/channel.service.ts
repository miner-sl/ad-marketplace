import { ChannelModel } from '../repositories/channel-model.repository';
import { Channel } from '../models/channel.types';
import { UserModel } from '../repositories/user.repository';
import { TelegramService } from './telegram.service';
import { TelegramNotificationService } from './telegram-notification.service';
import { topicsService } from './topics.service';
import { withTx } from '../utils/transaction';
import logger from '../utils/logger';
import {formatUsername} from "../models/tg.util";

export interface ChannelRegistrationResult {
  success: boolean;
  channel?: Channel;
  channelInfo?: {
    id: number;
    title?: string;
    username?: string;
    description?: string;
  };
  botUsername?: string;
  error?: 'USER_NOT_FOUND' | 'CHANNEL_ID_REQUIRED' | 'BOT_NOT_ADMIN' | 'CHANNEL_ALREADY_EXISTS' | 'FAILED_TO_CREATE';
  message?: string;
}

export interface ChannelStatusUpdateResult {
  success: boolean;
  channel?: Channel;
  error?: 'CHANNEL_NOT_FOUND' | 'UNAUTHORIZED' | 'NOT_VERIFIED' | 'NOT_ADMIN' | 'FAILED_TO_UPDATE';
  message?: string;
  statusCode?: number;
}

export class ChannelService {
  /**
   * Register a new channel for a user
   * Handles all business logic for channel registration including user validation
   */
  static async registerChannel(
    telegramUserId: number,
    username: string,
    priceTon?: number,
    topicId?: number
  ): Promise<ChannelRegistrationResult> {
    try {
      const user = await UserModel.findByTelegramId(telegramUserId);
      if (!user) {
        return {
          success: false,
          error: 'USER_NOT_FOUND',
          message: 'User not found. Please use /start first',
        };
      }

      const formattedUsername = formatUsername(username);

      const channelInfo = await TelegramService.getChannelInfoByUsername(formattedUsername);
      const telegramChannelId = channelInfo.id;

      const botInfo = await TelegramService.bot.getMe();
      const botId = botInfo.id;

      const existing = await ChannelModel.findByTelegramId(telegramChannelId);
      if (existing) {
        return {
          success: false,
          channel: existing,
          channelInfo: {
            id: telegramChannelId,
            title: channelInfo.title,
            username: channelInfo.username,
            description: channelInfo.description,
          },
          botUsername: botInfo.username,
          error: 'CHANNEL_ALREADY_EXISTS',
          message: 'Channel already registered',
        };
      }

      const isAdmin = await TelegramService.isBotAdmin(telegramChannelId);
      if (!isAdmin) {
        return {
          success: false,
          botUsername: botInfo.username,
          error: 'BOT_NOT_ADMIN',
          message: 'Bot is not admin of the channel',
        };
      }

      if (topicId !== undefined) {
        const topic = topicsService.getTopicById(topicId);
        if (!topic) {
          return {
            success: false,
            error: 'FAILED_TO_CREATE',
            message: `Topic with id ${topicId} not found`,
          };
        }
      }

      const channel = await withTx(async (client) => {
        const channelResult = await client.query(
          `INSERT INTO channels (owner_id, telegram_channel_id, username, title, description, topic_id, bot_admin_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING *`,
          [
            user.id,
            telegramChannelId,
            channelInfo.username,
            channelInfo.title,
            channelInfo.description,
            topicId || null,
            botId,
          ]
        );

        const newChannel = channelResult.rows[0];

        if (priceTon) {
          await ChannelModel.setPricingWithClient(
            client,
            newChannel.id,
            'post',
            priceTon,
            true
          );
        }

        return newChannel;
      });

      logger.info('Channel registered successfully', {
        channelId: channel.id,
        telegramChannelId,
        username: formattedUsername,
        priceTon,
        ownerId: user.id,
        telegramUserId,
      });

      try {
        await TelegramNotificationService.notifyChannelAddBot(
          telegramUserId,
          channelInfo.title || formattedUsername,
          channelInfo.username,
          botInfo.username!,
          channel.id
        );
      } catch (notifError: any) {
        logger.warn('Failed to send channel registration notification', {
          error: notifError.message,
          telegramUserId,
          channelId: channel.id,
        });
      }

      return {
        success: true,
        channel,
        channelInfo: {
          id: telegramChannelId,
          title: channelInfo.title,
          username: channelInfo.username,
          description: channelInfo.description,
        },
        botUsername: botInfo.username,
      };
    } catch (error: any) {
      logger.error('Failed to register channel', {
        error: error.message,
        stack: error.stack,
        telegramUserId,
        username,
        priceTon,
      });

      return {
        success: false,
        error: 'FAILED_TO_CREATE',
        message: error.message || 'Failed to register channel',
      };
    }
  }

  /**
   * Update channel active status (activate/deactivate)
   * Validates ownership, verification status, and admin permissions
   */
  static async updateChannelStatus(
    channelId: number,
    userId: number,
    telegramUserId: number,
    isActive: boolean
  ): Promise<ChannelStatusUpdateResult> {
    try {
      const channel = await withTx(async (client) => {
        const channelData = await ChannelModel.findByIdForUpdate(client, channelId);

        if (!channelData) {
          const error = new Error('Channel not found') as any;
          error.statusCode = 404;
          throw error;
        }

        if (channelData.owner_id !== userId) {
          const error = new Error('You do not have permission to update this channel') as any;
          error.statusCode = 403;
          error.errorCode = 'UNAUTHORIZED';
          throw error;
        }

        if (!channelData.is_verified) {
          const error = new Error('Channel must be verified before it can be activated/deactivated') as any;
          error.statusCode = 400;
          error.errorCode = 'NOT_VERIFIED';
          throw error;
        }

        const isAdmin = await TelegramService.isUserAdmin(
          channelData.telegram_channel_id,
          telegramUserId
        );

        if (!isAdmin) {
          const error = new Error('You are no longer an admin of this channel. Please verify your admin status.') as any;
          error.statusCode = 403;
          error.errorCode = 'NOT_ADMIN';
          throw error;
        }

        return await ChannelModel.updateActiveStatusWithClient(
          client,
          channelId,
          isActive
        );
      });

      logger.info('Channel status updated successfully', {
        channelId,
        userId,
        telegramUserId,
        isActive,
      });

      return {
        success: true,
        channel,
      };
    } catch (error: any) {
      logger.error('Failed to update channel status', {
        error: error.message,
        stack: error.stack,
        channelId,
        userId,
        telegramUserId,
      });

      return {
        success: false,
        error: error.errorCode || 'FAILED_TO_UPDATE',
        message: error.message || 'Failed to update channel status',
        statusCode: error.statusCode || 500,
      };
    }
  }

  /**
   * Validate if bot is admin of a channel by channel name/username
   * @param channelName - Channel username (with or without @)
   * @returns true if bot is admin, false otherwise
   */
  static async validateChannelAdmin(channelName: string): Promise<boolean> {
    try {
      const formattedUsername = formatUsername(channelName)

      const channelInfo = await TelegramService.getChannelInfoByUsername(formattedUsername);
      const telegramChannelId = channelInfo.id;

      const isAdmin = await TelegramService.isBotAdmin(telegramChannelId);
      return isAdmin;
    } catch (error: any) {
      logger.error('Failed to validate channel admin status', {
        error: error.message,
        channelName,
      });
      return false;
    }
  }
}
