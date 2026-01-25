import db from '../db/connection';

export interface Channel {
  id: number;
  owner_id: number;
  telegram_channel_id: number;
  username?: string;
  title?: string;
  description?: string;
  bot_admin_id?: number;
  is_verified: boolean;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface ChannelStats {
  id: number;
  channel_id: number;
  subscribers_count?: number;
  average_views?: number;
  average_reach?: number;
  language_distribution?: Record<string, number>;
  premium_subscribers_count?: number;
  stats_date: Date;
  created_at: Date;
}

export interface ChannelPricing {
  id: number;
  channel_id: number;
  ad_format: string;
  price_ton: number;
  currency: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export class ChannelModel {
  static async create(data: {
    owner_id: number;
    telegram_channel_id: number;
    username?: string;
    title?: string;
    description?: string;
  }): Promise<Channel> {
    const result = await db.query(
      `INSERT INTO channels (owner_id, telegram_channel_id, username, title, description)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [data.owner_id, data.telegram_channel_id, data.username, data.title, data.description]
    );
    return result.rows[0];
  }

  static async findByTelegramId(telegramChannelId: number): Promise<Channel | null> {
    const result = await db.query(
      'SELECT * FROM channels WHERE telegram_channel_id = $1',
      [telegramChannelId]
    );
    return result.rows[0] || null;
  }

  static async findByOwner(ownerId: number): Promise<Channel[]> {
    const result = await db.query(
      'SELECT * FROM channels WHERE owner_id = $1 ORDER BY created_at DESC',
      [ownerId]
    );
    return result.rows;
  }

  static async updateBotAdmin(channelId: number, botAdminId: number): Promise<Channel> {
    const result = await db.query(
      `UPDATE channels SET bot_admin_id = $1, is_verified = TRUE, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [botAdminId, channelId]
    );
    return result.rows[0];
  }

  static async saveStats(channelId: number, stats: {
    subscribers_count?: number;
    average_views?: number;
    average_reach?: number;
    language_distribution?: Record<string, number>;
    premium_subscribers_count?: number;
  }): Promise<ChannelStats> {
    const result = await db.query(
      `INSERT INTO channel_stats (channel_id, subscribers_count, average_views, average_reach, language_distribution, premium_subscribers_count)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        channelId,
        stats.subscribers_count,
        stats.average_views,
        stats.average_reach,
        stats.language_distribution ? JSON.stringify(stats.language_distribution) : null,
        stats.premium_subscribers_count,
      ]
    );
    return result.rows[0];
  }

  static async getLatestStats(channelId: number): Promise<ChannelStats | null> {
    const result = await db.query(
      `SELECT * FROM channel_stats 
       WHERE channel_id = $1 
       ORDER BY stats_date DESC 
       LIMIT 1`,
      [channelId]
    );
    return result.rows[0] || null;
  }

  static async setPricing(channelId: number, format: string, priceTon: number): Promise<ChannelPricing> {
    const result = await db.query(
      `INSERT INTO channel_pricing (channel_id, ad_format, price_ton)
       VALUES ($1, $2, $3)
       ON CONFLICT (channel_id, ad_format) 
       DO UPDATE SET price_ton = $3, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [channelId, format, priceTon]
    );
    return result.rows[0];
  }

  static async getPricing(channelId: number): Promise<ChannelPricing[]> {
    const result = await db.query(
      'SELECT * FROM channel_pricing WHERE channel_id = $1 AND is_active = TRUE',
      [channelId]
    );
    return result.rows;
  }

  static async verifyAdminStatus(channelId: number, userId: number, telegramUserId: number): Promise<boolean> {
    // Check if user is channel owner
    const channel = await db.query(
      'SELECT owner_id FROM channels WHERE id = $1',
      [channelId]
    );
    if (channel.rows[0]?.owner_id === userId) {
      return true;
    }

    // Check if user is an active manager
    const manager = await db.query(
      'SELECT * FROM channel_managers WHERE channel_id = $1 AND telegram_user_id = $2 AND is_active = TRUE',
      [channelId, telegramUserId]
    );
    return manager.rows.length > 0;
  }
}
