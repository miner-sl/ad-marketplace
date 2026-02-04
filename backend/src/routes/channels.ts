import { FastifyPluginAsync } from 'fastify';
import { ChannelModel } from '../models/Channel';
import { ChannelRepository } from '../repositories/ChannelRepository';
import { UserModel } from '../models/User';
import { TelegramService } from '../services/telegram';
import { ChannelService } from '../services/channel';
import { topicsService } from '../services/topics';
import { validateBody } from '../middleware/validation';
import { authMiddleware } from '../middleware/auth';
import { createChannelSchema } from '../utils/validation';
import logger from '../utils/logger';

const channelsRouter: FastifyPluginAsync = async (fastify) => {
  // List channels with filters
  fastify.get('/', async (request, reply) => {
    try {
      const {
        min_subscribers,
        max_subscribers,
        min_price,
        max_price,
        ad_format,
        limit = 50,
        offset = 0,
      } = request.query as any;

      const filters = {
        min_subscribers: min_subscribers !== undefined && min_subscribers !== null && min_subscribers !== '' 
          ? parseInt(min_subscribers as string) 
          : undefined,
        max_subscribers: max_subscribers !== undefined && max_subscribers !== null && max_subscribers !== '' 
          ? parseInt(max_subscribers as string) 
          : undefined,
        min_price: min_price !== undefined && min_price !== null && min_price !== '' 
          ? parseFloat(min_price as string) 
          : undefined,
        max_price: max_price !== undefined && max_price !== null && max_price !== '' 
          ? parseFloat(max_price as string) 
          : undefined,
        ad_format: ad_format as string | undefined,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      };

      const channels = await ChannelRepository.listChannelsWithFilters(filters);
      return channels;
    } catch (error: any) {
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
  fastify.post('/:id/pricing', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { ad_format, price_ton, is_active } = request.body as any;
      const pricing = await ChannelModel.setPricing(
        parseInt(id),
        ad_format,
        parseFloat(price_ton),
        is_active !== undefined ? Boolean(is_active) : true
      );
      return pricing;
    } catch (error: any) {
      reply.code(500).send({ error: error.message });
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
        channelId: request.id,
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
