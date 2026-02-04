import { ChannelModel } from '../repositories/channel-model.repository';
import { Channel } from '../models/channel.types';
import { UserModel } from '../repositories/user.repository';
import { TelegramService } from './telegram.service';
import { topicsService } from './topics.service';
import { withTx } from '../utils/transaction';
import logger from '../utils/logger';

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
    telegramChannelId: number,
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

      const botInfo = await TelegramService.bot.getMe();
      const botId = botInfo.id;

      const existing = await ChannelModel.findByTelegramId(telegramChannelId);
      if (existing) {
        const channelInfo = await TelegramService.getChannelInfo(telegramChannelId);
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

      const channelInfo = await TelegramService.getChannelInfo(telegramChannelId);

      // Validate topic if provided (using cached topics service)
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

      const channel = await ChannelModel.create({
        owner_id: user.id,
        telegram_channel_id: telegramChannelId,
        username: channelInfo.username,
        title: channelInfo.title,
        description: channelInfo.description,
        topic_id: topicId,
      });

      await ChannelModel.updateBotAdmin(channel.id, botId);

      logger.info('Channel registered successfully', {
        channelId: channel.id,
        telegramChannelId,
        ownerId: user.id,
        telegramUserId,
      });

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
        telegramChannelId,
      });

      return {
        success: false,
        error: 'FAILED_TO_CREATE',
        message: error.message || 'Failed to register channel',
      };
    }
  }

  /**
   * Check if bot is admin of a channel
   */
  static async verifyBotAdminStatus(telegramChannelId: number): Promise<boolean> {
    return await TelegramService.isBotAdmin(telegramChannelId);
  }

  /**
   * Get channel info from Telegram
   */
  static async getChannelInfo(telegramChannelId: number) {
    return await TelegramService.getChannelInfo(telegramChannelId);
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
}
