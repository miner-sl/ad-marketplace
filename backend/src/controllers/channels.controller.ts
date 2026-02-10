import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { ChannelModel } from '../repositories/channel-model.repository';
import { ChannelRepository } from '../repositories/channel.repository';
import { UserModel } from '../repositories/user.repository';
import { TelegramService } from '../services/telegram.service';
import { ChannelService } from '../services/channel.service';
import { topicsService } from '../services/topics.service';
import { setChannelPricingSchema, updateChannelStatusSchema, updateChannelSchema, validateChannelSchema } from '../utils/validation';
import logger from '../utils/logger';

export class ChannelsController {
  static async getChannelsByFilters(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = request.query as {
        min_subscribers?: number;
        max_subscribers?: number;
        min_price?: number;
        max_price?: number;
        ad_format?: string;
        topic_id?: number;
        search?: string;
        ownerTelegramId?: boolean;
        status?: 'active' | 'inactive' | 'moderation';
        limit?: number;
        offset?: number;
      };

      const filters = {
        min_subscribers: query.min_subscribers,
        max_subscribers: query.max_subscribers,
        min_price: query.min_price,
        max_price: query.max_price,
        ad_format: query.ad_format,
        topic_id: query.topic_id,
        search: query.search,
        ownerId: query.ownerTelegramId
          ? request.user?.id
          : undefined,
        status: query.status,
        limit: query.limit || 50,
        offset: query.offset || 0,
      };

      const channels = await ChannelRepository.listChannelsWithFilters(filters);
      return channels;
    } catch (error: any) {
      logger.error('Failed to list channels', {
        error: error.message,
        stack: error.stack,
        userId: request.user?.id,
      });
      reply.code(500).send({ error: error.message });
    }
  }

  static async getChannelById(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const channel = await ChannelRepository.findByIdWithDetails(parseInt(id));

      if (!channel) {
        return reply.code(404).send({ error: 'Channel not found' });
      }

      return {...channel, id: channel.channel_id};
    } catch (error: any) {
      reply.code(500).send({ error: error.message });
    }
  }

  static async registerChannel(request: FastifyRequest, reply: FastifyReply) {
    try {
      if (!request.user?.telegramId) {
        return reply.code(400).send({
          error: 'Invalid user',
          message: 'Telegram ID not found in token',
        });
      }

      const { username, price_ton } = request.body as any;
      const topic_id = (request.body as any)?.topic_id ? parseInt((request.body as any).topic_id) : undefined;

      if (!username || !price_ton) {
        return reply.code(400).send({
          error: 'Missing required fields',
          message: 'username and price_ton are required',
        });
      }

      const result = await ChannelService.registerChannel(
        request.user.telegramId,
        username,
        price_ton,
        topic_id
      );

      if (!result.success) {
        switch (result.error) {
          case 'USER_NOT_FOUND':
            return reply.code(404).send({
              error: result.error,
              message: result.message || 'User not found',
            });

          case 'CHANNEL_ALREADY_EXISTS':
            return reply.code(409).send({
              error: result.error,
              message: result.message || 'Channel already registered',
              channel: result.channel,
            });

          case 'BOT_NOT_ADMIN':
            return reply.code(400).send({
              error: result.error,
              message: result.message || 'Bot is not admin of the channel',
            });

          case 'FAILED_TO_CREATE':
            return reply.code(500).send({
              error: result.error,
              message: result.message || 'Failed to register channel',
            });

          default:
            return reply.code(500).send({
              error: 'UNKNOWN_ERROR',
              message: result.message || 'An error occurred',
            });
        }
      }

      if (result.channel && result.channelInfo) {
        const stats = await TelegramService.fetchChannelStats(result.channel.telegram_channel_id);
        await ChannelModel.saveStats(result.channel.id, stats);

        if (request.user.telegramId) {
          await UserModel.updateRole(request.user.telegramId, 'channel_owner', true);
        }
      }

      return result.channel;
    } catch (error: any) {
      logger.error('Channel registration endpoint error', {
        error: error.message,
        stack: error.stack,
        userId: request.user?.id,
        telegramId: request.user?.telegramId,
      });
      return reply.code(500).send({ error: error.message });
    }
  }

  static async setChannelPricing(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const channelId = parseInt(id);
      const body = request.body as z.infer<typeof setChannelPricingSchema>;

      const ownerId = await ChannelRepository.getOwnerId(channelId);
      if (!ownerId) {
        return reply.code(404).send({ error: 'Channel not found' });
      }

      if (ownerId !== request.user?.id) {
        return reply.code(403).send({
          error: 'Forbidden',
          message: 'You do not have permission to set pricing for this channel'
        });
      }

      const pricing = await ChannelModel.setPricing(
        channelId,
        body.ad_format,
        body.price_ton,
        body.is_active ?? true
      );
      return pricing;
    } catch (error: any) {
      logger.error('Failed to set channel pricing', {
        error: error.message,
        stack: error.stack,
        channelId: (request.params as { id: string }).id,
        userId: request.user?.id,
      });
      reply.code(500).send({ error: error.message });
    }
  }

  static async updateChannelStatus(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const channelId = parseInt(id);
      const body = request.body as z.infer<typeof updateChannelStatusSchema>;

      if (!request.user?.telegramId || !request.user?.id) {
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'Telegram ID or user ID not found in token'
        });
      }

      const result = await ChannelService.updateChannelStatus(
        channelId,
        request.user.id,
        request.user.telegramId,
        body.is_active
      );

      if (!result.success) {
        const statusCode = result.statusCode || 500;
        return reply.code(statusCode).send({
          error: result.error || 'Failed to update channel status',
          message: result.message,
        });
      }

      return {
        id: result.channel!.id,
        is_active: result.channel!.is_active,
        message: result.channel!.is_active ? 'Channel activated successfully' : 'Channel deactivated successfully',
      };
    } catch (error: any) {
      logger.error('Failed to update channel status', {
        error: error.message,
        stack: error.stack,
        channelId: (request.params as { id: string }).id,
        userId: request.user?.id,
      });

      reply.code(500).send({
        error: 'Failed to update channel status',
        message: error.message
      });
    }
  }

  static async getAllTopics(_: FastifyRequest, reply: FastifyReply) {
    try {
      const topics = topicsService.getAllTopics();
      return topics;
    } catch (error: any) {
      logger.error('Failed to get topics', { error: error.message });
      reply.code(500).send({ error: error.message });
    }
  }

  static async updateChannel(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const channelId = parseInt(id);
      const body = request.body as z.infer<typeof updateChannelSchema>;

      if (!request.user?.id) {
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'User ID not found in token',
        });
      }

      const channel = await ChannelModel.findChannelOwnerById(channelId);
      if (!channel) {
        return reply.code(404).send({
          error: 'Channel not found',
        });
      }

      if (channel.owner_id !== request.user.id) {
        return reply.code(403).send({
          error: 'Forbidden',
          message: 'You do not have permission to update this channel',
        });
      }

      const updates: {
        is_active?: boolean;
        topic_id?: number | null;
        price_ton?: number;
      } = {};

      if (body.active !== undefined) {
        updates.is_active = body.active;
      }

      if (body.topic !== undefined) {
        updates.topic_id = body.topic;
      }

      if (body.price !== undefined) {
        updates.price_ton = body.price;
      }

      const updatedChannel = await ChannelModel.updateChannel(channelId, updates);

      return {
        id: updatedChannel.id,
        is_active: updatedChannel.is_active,
        topic_id: updatedChannel.topic_id,
        message: 'Channel updated successfully',
      };
    } catch (error: any) {
      logger.error('Failed to update channel', {
        error: error.message,
        stack: error.stack,
        channelId: (request.params as { id: string }).id,
        userId: request.user?.id,
      });

      reply.code(500).send({
        error: 'Failed to update channel',
        message: error.message,
      });
    }
  }

  static async validateChannelAdmin(request: FastifyRequest, reply: FastifyReply) {
    try {
      if (!request.user?.id) {
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'User ID not found in token',
        });
      }

      const { channelName } = request.body as z.infer<typeof validateChannelSchema>;

      if (!channelName) {
        return reply.code(400).send({
          error: 'Missing required field',
          message: 'channelName is required',
        });
      }
      //
      // const isAllowed = await throttleChannelValidate(request.user.id, channelName, 5);
      //
      // if (!isAllowed) {
      //   return reply.code(429).send({
      //     error: 'Too Many Requests',
      //     message: 'Please wait a few seconds before checking again',
      //   });
      // }

      const isAdmin = await ChannelService.validateChannelAdmin(channelName);

      return {
        isAdmin,
      };
    } catch (error: any) {
      logger.error('Channel validation endpoint error', {
        error: error.message,
        stack: error.stack,
        userId: request.user?.id,
        channelName: (request.body as any)?.channelName,
      });
      return reply.code(500).send({ error: error.message });
    }
  }
}
