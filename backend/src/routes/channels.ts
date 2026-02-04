import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ChannelModel } from '../models/Channel';
import { ChannelRepository } from '../repositories/ChannelRepository';
import { UserModel } from '../models/User';
import { TelegramService } from '../services/telegram';
import { ChannelService } from '../services/channel';
import { topicsService } from '../services/topics';
import { validateBody, validateQuery } from '../middleware/validation';
import { authMiddleware } from '../middleware/auth';
import { createChannelSchema, listChannelsQuerySchema, setChannelPricingSchema, updateChannelStatusSchema } from '../utils/validation';
import logger from '../utils/logger';

const channelsRouter: FastifyPluginAsync = async (fastify) => {
  // List channels with filters (requires authentication)
  fastify.get('/', {
    preHandler: [authMiddleware, validateQuery(listChannelsQuerySchema)],
  }, async (request, reply) => {
    try {
      const query = request.query as {
        min_subscribers?: number;
        max_subscribers?: number;
        min_price?: number;
        max_price?: number;
        ad_format?: string;
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
  });

  // Get channel details
  fastify.get('/:id', async (request, reply) => {
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
  });

  // Register channel
  fastify.post('/', {
    preHandler: [authMiddleware, validateBody(createChannelSchema)],
  }, async (request, reply) => {
    try {
      if (!request.user?.telegramId) {
        return reply.code(400).send({
          error: 'Invalid user',
          message: 'Telegram ID not found in token',
        });
      }

      const { telegram_channel_id } = request.body as any;
      const topic_id = (request.body as any)?.topic_id ? parseInt((request.body as any).topic_id) : undefined;

      const result = await ChannelService.registerChannel(
        request.user.telegramId,
        telegram_channel_id,
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

      if (result.channel) {
        const stats = await TelegramService.fetchChannelStats(telegram_channel_id);
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
  });

  // Set pricing
  fastify.post('/:id/pricing', {
    preHandler: [authMiddleware, validateBody(setChannelPricingSchema)],
  }, async (request, reply) => {
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
  });

  // Update channel status (activate/deactivate)
  fastify.patch('/:id/status', {
    preHandler: [authMiddleware, validateBody(updateChannelStatusSchema)],
  }, async (request, reply) => {
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
  });

  // Refresh channel stats
  fastify.post('/:id/refresh-stats', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const channel = await ChannelRepository.findById(parseInt(id));
      if (!channel || !channel.telegram_channel_id) {
        return reply.code(404).send({ error: 'Channel not found' });
      }

      const stats = await TelegramService.fetchChannelStats(channel.telegram_channel_id);
      const savedStats = await ChannelModel.saveStats(parseInt(id), stats);
      return savedStats;
    } catch (error: any) {
      logger.error('Channel stats refresh endpoint error', {
        error: error.message,
        stack: error.stack,
        channelId: (request.params as { id: string }).id,
      });
      reply.code(500).send({ error: error.message });
    }
  });

  // Get all topics (from cached singleton)
  fastify.get('/topics', async (request, reply) => {
    try {
      const topics = topicsService.getAllTopics();
      return topics;
    } catch (error: any) {
      logger.error('Failed to get topics', { error: error.message });
      reply.code(500).send({ error: error.message });
    }
  });

  // Get topic by ID (from cached singleton)
  fastify.get('/topics/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const topic = topicsService.getTopicById(parseInt(id));

      if (!topic) {
        return reply.code(404).send({ error: 'Topic not found' });
      }

      return topic;
    } catch (error: any) {
      logger.error('Failed to get topic', { error: error.message, topicId: (request.params as { id: string }).id });
      reply.code(500).send({ error: error.message });
    }
  });
};

export default channelsRouter;
