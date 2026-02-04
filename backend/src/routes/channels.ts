import { FastifyPluginAsync } from 'fastify';
import { ChannelModel } from '../models/Channel';
import { ChannelRepository } from '../repositories/ChannelRepository';
import { UserModel } from '../models/User';
import { TelegramService } from '../services/telegram';
import { validateBody } from '../middleware/validation';
import { createChannelSchema } from '../utils/validation';

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
    preHandler: [validateBody(createChannelSchema)],
  }, async (request, reply) => {
    try {
      const { telegram_id, telegram_channel_id, bot_token, username, first_name, last_name } = request.body as any;

      // Find or create user
      const user = await UserModel.findOrCreate({
        telegram_id,
        username,
        first_name,
        last_name,
      });

      // Verify bot is admin
      const isAdmin = await TelegramService.isBotAdmin(telegram_channel_id);
      if (!isAdmin) {
        return reply.code(400).send({
          error: 'Bot must be added as admin to the channel',
        });
      }

      // Get channel info
      const channelInfo = await TelegramService.getChannelInfo(telegram_channel_id);

      // Create channel
      const channel = await ChannelModel.create({
        owner_id: user.id,
        telegram_channel_id,
        username: channelInfo.username,
        title: channelInfo.title,
        description: channelInfo.description,
      });

      // Update bot admin ID
      await ChannelModel.updateBotAdmin(channel.id, parseInt(bot_token.split(':')[0]));

      // Fetch and save stats
      const stats = await TelegramService.fetchChannelStats(telegram_channel_id);
      await ChannelModel.saveStats(channel.id, stats);

      // Update user role
      await UserModel.updateRole(telegram_id, 'channel_owner', true);

      return channel;
    } catch (error: any) {
      reply.code(500).send({ error: error.message });
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
      reply.code(500).send({ error: error.message });
    }
  });
};

export default channelsRouter;
