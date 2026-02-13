import { ChannelModel } from '../repositories/channel-model.repository';
import { Channel } from '../models/channel.types';
import { UserModel } from '../repositories/user.repository';
import { TelegramService } from './telegram.service';
import { TelegramNotificationService } from './telegram-notification.service';
import {ChannelListFilters, ChannelRepository} from '../repositories/channel.repository';

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

export interface UpdateChannelDto {
  active?: boolean;
  price?: number;
  topic?: number | null;
  country?: string | null;
  locale?: string | null;
}
export interface ChannelStatusUpdateResult {
  success: boolean;
  channel?: Channel;
  error?: 'CHANNEL_NOT_FOUND' | 'UNAUTHORIZED' | 'NOT_VERIFIED' | 'NOT_ADMIN' | 'FAILED_TO_UPDATE';
  message?: string;
  statusCode?: number;
}

export class ChannelService {

  static async listChannelsWithFilters(filters: ChannelListFilters): Promise<any[]> {
    try {
      if (filters.search) {
        filters.search = this.normalizeSearchQuery(filters.search);
      }
      const channels = await ChannelRepository.listChannelsWithFilters(filters);
      return channels;
    } catch (error: any) {
      return [];
    }
  }

  private static normalizeSearchQuery(search: string): string {
    if (!search) {
      return search;
    }
    if (search.startsWith('https://t.me/')) {
      return search.substring('https://t.me/'.length);
    }
    if (search.startsWith('t.me/')) {
      return search.substring('t.me/'.length);
    }
    if (search.startsWith('@')) {
      return search.substring(1);
    }
    return search;
  }
  /**
   * Register a new channel for a user
   * Handles all business logic for channel registration including user validation
   */
  static async registerChannel(
    telegramUserId: number,
    username: string,
    priceTon?: number,
    topicId?: number,
    country?: string,
    locale?: string
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
      if (await ChannelService.channelAlreadyAdded(username)) {
        return {
          success: false,
          error: 'CHANNEL_ALREADY_EXISTS',
          message: 'Channel already registered',
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
          `INSERT INTO channels (owner_id, telegram_channel_id, username, title, description, topic_id, bot_admin_id, country, locale)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING *`,
          [
            user.id,
            telegramChannelId,
            channelInfo.username,
            channelInfo.title,
            channelInfo.description,
            topicId || null,
            botId,
            country || null,
            locale || null,
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

  static async channelAlreadyAdded(username:string) {
    const formattedUsername = username.startsWith('@') ? username.substring(1) : `${username}`;
    const channel = await ChannelRepository.findByChannelUsername(formattedUsername);
    return channel !== null;
  }

  static async validateChannel(channelUsername: string): Promise<{ ok: boolean, message?: string }> {
    try {
      if (await this.channelAlreadyAdded(channelUsername)) {
        return {
          ok: false,
          message: 'Channel already added'
        }
      }
      const isAdmin = await this.validateChannelAdmin(channelUsername);
      console.log(isAdmin, channelUsername)
      return {
        ok: isAdmin,
      };
    } catch (error: any) {
      logger.error('Failed to validate channel admin status', {
        error: error.message,
        channelUsername,
      });
      return {ok: false, message: 'failed'};
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

  static async update(userId: number, channelId: number, body: UpdateChannelDto) {
    const channel = await ChannelModel.findChannelOwnerById(channelId);
    if (!channel) {
      return {
        ok: false,
        status: 404,
        error: 'Channel not found',
      }
    }

    if (channel.owner_id !== userId) {
      return{
        ok: false,
        status: 403,
        error: 'Forbidden',
        message: 'You do not have permission to update this channel',
      };
    }

    const updates: {
      is_active?: boolean;
      topic_id?: number | null;
      price_ton?: number;
      country?: string | null;
      locale?: string | null;
    } = {};

    if (body.active !== undefined) {
      updates.is_active = body.active;
    }

    if (body.topic !== undefined) {
      updates.topic_id = body.topic;
    }

    if (body.country !== undefined) {
      updates.country = body.country;
    }

    if (body.locale !== undefined) {
      updates.locale = body.locale;
    }

    if (body.price !== undefined) {
      updates.price_ton = body.price;
      await ChannelModel.setPricing(
        channelId,
        'post',
        body.price,
        true,
      );
    }

    const updatedChannel = await ChannelModel.updateChannel(channelId, updates);

    return {
      ok: true,
      data: {
        id: updatedChannel.id,
        is_active: updatedChannel.is_active,
        topic_id: updatedChannel.topic_id,
        message: 'Channel updated successfully',
      }
    };
  }
}
