import { Router } from 'express';
import { ChannelModel } from '../models/Channel';
import { ChannelRepository } from '../repositories/ChannelRepository';
import { UserModel } from '../models/User';
import { TelegramService } from '../services/telegram';
import { validate } from '../middleware/validation';
import { createChannelSchema } from '../utils/validation';

const channelsRouter = Router();

// List channels with filters
channelsRouter.get('/', async (req, res) => {
  try {
    const {
      min_subscribers,
      max_subscribers,
      min_price,
      max_price,
      ad_format,
      limit = 50,
      offset = 0,
    } = req.query;

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
    res.json(channels);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get channel details
channelsRouter.get('/:id', async (req, res) => {
  try {
    const channel = await ChannelRepository.findByIdWithDetails(parseInt(req.params.id));

    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    res.json({...channel, id: channel.channel_id});
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Register channel
channelsRouter.post('/', validate(createChannelSchema), async (req, res) => {
  try {
    const { telegram_id, telegram_channel_id, bot_token } = req.body;

    // Find or create user
    const user = await UserModel.findOrCreate({
      telegram_id,
      username: req.body.username,
      first_name: req.body.first_name,
      last_name: req.body.last_name,
    });

    // Verify bot is admin
    const isAdmin = await TelegramService.isBotAdmin(telegram_channel_id);
    if (!isAdmin) {
      return res.status(400).json({
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

    res.json(channel);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Set pricing
channelsRouter.post('/:id/pricing', async (req, res) => {
  try {
    const { ad_format, price_ton } = req.body;
    const pricing = await ChannelModel.setPricing(
      parseInt(req.params.id),
      ad_format,
      parseFloat(price_ton)
    );
    res.json(pricing);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Refresh channel stats
channelsRouter.post('/:id/refresh-stats', async (req, res) => {
  try {
    const channel = await ChannelRepository.findById(parseInt(req.params.id));
    if (!channel || !channel.telegram_channel_id) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    const stats = await TelegramService.fetchChannelStats(channel.telegram_channel_id);
    const savedStats = await ChannelModel.saveStats(parseInt(req.params.id), stats);
    res.json(savedStats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default channelsRouter;
