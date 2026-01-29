import { Router } from 'express';
import { ChannelModel } from '../models/Channel';
import { UserModel } from '../models/User';
import { TelegramService } from '../services/telegram';
import { validate } from '../middleware/validation';
import { createChannelSchema } from '../utils/validation';
import db from '../db/connection';

const router = Router();

// List channels with filters
router.get('/', async (req, res) => {
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

    let query = `
      SELECT c.*, cs.subscribers_count, cs.average_views, cp.price_ton, cp.ad_format
      FROM channels c
      LEFT JOIN LATERAL (
        SELECT * FROM channel_stats 
        WHERE channel_id = c.id 
        ORDER BY stats_date DESC 
        LIMIT 1
      ) cs ON true
      LEFT JOIN channel_pricing cp ON cp.channel_id = c.id AND cp.is_active = TRUE
      WHERE c.is_active = TRUE
    `;
    const params: any[] = [];
    let paramCount = 1;

    if (min_subscribers) {
      query += ` AND cs.subscribers_count >= $${paramCount++}`;
      params.push(parseInt(min_subscribers as string));
    }
    if (max_subscribers) {
      query += ` AND cs.subscribers_count <= $${paramCount++}`;
      params.push(parseInt(max_subscribers as string));
    }
    if (ad_format) {
      query += ` AND cp.ad_format = $${paramCount++}`;
      params.push(ad_format);
    }
    if (min_price) {
      query += ` AND cp.price_ton >= $${paramCount++}`;
      params.push(parseFloat(min_price as string));
    }
    if (max_price) {
      query += ` AND cp.price_ton <= $${paramCount++}`;
      params.push(parseFloat(max_price as string));
    }

    query += ` ORDER BY c.created_at DESC LIMIT $${paramCount++} OFFSET $${paramCount++}`;
    params.push(parseInt(limit as string), parseInt(offset as string));

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get channel details
router.get('/:id', async (req, res) => {
  try {
    const channel = await db.query(
      `SELECT c.*, cs.*, 
       (SELECT json_agg(cp.*) FROM channel_pricing cp WHERE cp.channel_id = c.id AND cp.is_active = TRUE) as pricing
       FROM channels c
       LEFT JOIN LATERAL (
         SELECT * FROM channel_stats 
         WHERE channel_id = c.id 
         ORDER BY stats_date DESC 
         LIMIT 1
       ) cs ON true
       WHERE c.id = $1`,
      [req.params.id]
    );

    if (channel.rows.length === 0) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    res.json(channel.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Register channel
router.post('/', validate(createChannelSchema), async (req, res) => {
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
router.post('/:id/pricing', async (req, res) => {
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
router.post('/:id/refresh-stats', async (req, res) => {
  try {
    const channel = await db.query('SELECT * FROM channels WHERE id = $1', [req.params.id]);
    if (channel.rows.length === 0) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    const stats = await TelegramService.fetchChannelStats(
      channel.rows[0].telegram_channel_id
    );
    const savedStats = await ChannelModel.saveStats(parseInt(req.params.id), stats);
    res.json(savedStats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
