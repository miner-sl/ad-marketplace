import type { PoolClient } from 'pg';
import db from '../db/connection';
import { withTx } from '../utils/transaction';
import { Channel, Topic, ChannelStats, ChannelPricing } from '../models/channel.types';

export class ChannelModel {
  static async create(data: {
    owner_id: number;
    telegram_channel_id: number;
    username?: string;
    title?: string;
    description?: string;
    topic_id?: number;
  }): Promise<Channel> {
    const result = await db.query(
      `INSERT INTO channels (owner_id, telegram_channel_id, username, title, description, topic_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [data.owner_id, data.telegram_channel_id, data.username, data.title, data.description, data.topic_id || null]
    );
    return result.rows[0];
  }

  static async findAllTopics(): Promise<Topic[]> {
    const result = await db.query(
      'SELECT * FROM topics ORDER BY name ASC'
    );
    return result.rows;
  }

  static async findByTelegramId(telegramChannelId: number): Promise<Channel | null> {
    const result = await db.query(
      'SELECT * FROM channels WHERE telegram_channel_id = $1',
      [telegramChannelId]
    );
    return result.rows[0] || null;
  }

  static async findChannelOwnerById(channelId: number): Promise<Pick<Channel, 'owner_id'> | null> {
    const result = await db.query(
      'SELECT owner_id FROM channels WHERE id = $1',
      [channelId]
    );
    return result.rows[0] || null;
  }

  /**
   * Find channel by ID with FOR UPDATE lock (for use within transactions)
   * Returns channel data needed for status updates and ownership checks
   */
  static async findByIdForUpdate(
    client: PoolClient,
    channelId: number
  ): Promise<{
    id: number;
    owner_id: number;
    telegram_channel_id: number;
    is_verified: boolean;
    is_active: boolean;
  } | null> {
    const result = await client.query(
      `SELECT id, owner_id, telegram_channel_id, is_verified, is_active 
       FROM channels 
       WHERE id = $1 FOR UPDATE`,
      [channelId]
    );

    if (!result.rows || result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  }

  static async findByOwner(ownerId: number): Promise<Channel[]> {
    const result = await db.query(
      'SELECT * FROM channels WHERE owner_id = $1 ORDER BY created_at DESC',
      [ownerId]
    );
    return result.rows;
  }

  static async updateBotAdmin(channelId: number, botAdminId: number): Promise<Channel> {
    return await withTx(async (client) => {
      const result = await client.query(
        `UPDATE channels SET bot_admin_id = $1, is_verified = TRUE, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING *`,
        [botAdminId, channelId]
      );

      if (result.rows.length === 0) {
        throw new Error(`Channel #${channelId} not found`);
      }

      return result.rows[0];
    });
  }

  static async saveStats(channelId: number, stats: {
    subscribers_count?: number;
    average_views?: number;
    average_reach?: number;
    language_distribution?: Record<string, number>;
    premium_subscribers_count?: number;
    /** Full Telegram stats JSON to store in channel_stats.statistic */
    statistic?: Record<string, unknown>;
  }): Promise<ChannelStats> {
    const result = await db.query(
      `INSERT INTO channel_stats (channel_id, subscribers_count, average_views, average_reach, language_distribution, premium_subscribers_count, statistic)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        channelId,
        stats.subscribers_count,
        stats.average_views,
        stats.average_reach,
        stats.language_distribution ? JSON.stringify(stats.language_distribution) : null,
        stats.premium_subscribers_count,
        stats.statistic != null ? JSON.stringify(stats.statistic) : null,
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

  /**
   * Set pricing for a channel (internal method that accepts a client)
   * Used when you want to include this operation in an existing transaction
   */
  static async setPricingWithClient(
    client: PoolClient,
    channelId: number,
    format: string,
    priceTon: number,
    isActive: boolean = true
  ): Promise<ChannelPricing> {
    const result = await client.query(
      `INSERT INTO channel_pricing (channel_id, ad_format, price_ton, is_active)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (channel_id, ad_format) 
       DO UPDATE SET price_ton = $3, is_active = $4, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [channelId, format, priceTon, isActive]
    );

    if (result.rows.length === 0) {
      throw new Error(`Failed to set pricing for Channel #${channelId}, format: ${format}`);
    }

    return result.rows[0];
  }

  /**
   * Set pricing for a channel (creates its own transaction)
   */
  static async setPricing(
    channelId: number,
    format: string,
    priceTon: number,
    isActive: boolean = true
  ): Promise<ChannelPricing> {
    return await withTx(async (client) => {
      return await this.setPricingWithClient(client, channelId, format, priceTon, isActive);
    });
  }

  static async getPricing(channelId: number): Promise<ChannelPricing[]> {
    const result = await db.query(
      'SELECT * FROM channel_pricing WHERE channel_id = $1 AND is_active = TRUE',
      [channelId]
    );
    return result.rows;
  }

  /**
   * Update channel active status (internal method that accepts a client)
   * Used when you want to include this operation in an existing transaction
   */
  static async updateActiveStatusWithClient(
    client: PoolClient,
    channelId: number,
    isActive: boolean
  ): Promise<Channel> {
    const result = await client.query(
      `UPDATE channels 
       SET is_active = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [isActive, channelId]
    );

    if (result.rows.length === 0) {
      throw new Error(`Channel #${channelId} not found`);
    }

    return result.rows[0];
  }

  /**
   * Update channel active status (creates its own transaction)
   */
  static async updateActiveStatus(
    channelId: number,
    isActive: boolean
  ): Promise<Channel> {
    return await withTx(async (client) => {
      return await this.updateActiveStatusWithClient(client, channelId, isActive);
    });
  }

  /**
   * Update channel info (active status, topic_id, and pricing)
   */
  static async updateChannel(
    channelId: number,
    updates: {
      is_active?: boolean;
      topic_id?: number | null;
      price_ton?: number;
      country?: string | null;
      locale?: string | null;
    }
  ): Promise<Channel> {
    return await withTx(async (client) => {
      const updateFields: string[] = [];
      const updateValues: any[] = [];
      let paramIndex = 1;

      if (updates.is_active !== undefined) {
        updateFields.push(`is_active = $${paramIndex++}`);
        updateValues.push(updates.is_active);
      }

      if (updates.topic_id !== undefined) {
        updateFields.push(`topic_id = $${paramIndex++}`);
        updateValues.push(updates.topic_id);
      }

      if (updates.country !== undefined) {
        updateFields.push(`country = $${paramIndex++}`);
        updateValues.push(updates.country);
      }

      if (updates.locale !== undefined) {
        updateFields.push(`locale = $${paramIndex++}`);
        updateValues.push(updates.locale);
      }

      updateFields.push(`updated_at = CURRENT_TIMESTAMP`);

      if (updateFields.length === 1) {
        // Only updated_at, no actual changes
        const result = await client.query(
          `SELECT * FROM channels WHERE id = $1`,
          [channelId]
        );
        if (result.rows.length === 0) {
          throw new Error(`Channel #${channelId} not found`);
        }
        return result.rows[0];
      }

      updateValues.push(channelId);

      const result = await client.query(
        `UPDATE channels 
         SET ${updateFields.join(', ')}
         WHERE id = $${paramIndex}
         RETURNING *`,
        updateValues
      );

      if (result.rows.length === 0) {
        throw new Error(`Channel #${channelId} not found`);
      }

      if (updates.price_ton !== undefined) {
        await client.query(
          `INSERT INTO channel_pricing (channel_id, ad_format, price_ton, is_active)
           VALUES ($1, 'post', $2, true)
           ON CONFLICT (channel_id, ad_format) 
           DO UPDATE SET price_ton = $2, is_active = true, updated_at = CURRENT_TIMESTAMP`,
          [channelId, updates.price_ton]
        );
      }

      return result.rows[0];
    });
  }

  static async getPricingById(pricingId: number): Promise<(ChannelPricing & { owner_id: number }) | null> {
    const result = await db.query(
      `SELECT cp.*, c.owner_id 
       FROM channel_pricing cp
       INNER JOIN channels c ON cp.channel_id = c.id
       WHERE cp.id = $1 AND cp.is_active = TRUE`,
      [pricingId]
    );
    if (!result.rows || result.rows.length === 0) {
      return null;
    }
    const row = result.rows[0];
    return {
      id: row.id,
      channel_id: row.channel_id,
      ad_format: row.ad_format,
      price_ton: row.price_ton,
      currency: row.currency,
      is_active: row.is_active,
      created_at: row.created_at,
      updated_at: row.updated_at,
      owner_id: row.owner_id,
    };
  }

  static async verifyAdminStatus(channelId: number, userId: number, telegramUserId: number): Promise<boolean> {
    const channel = await db.query(
      'SELECT owner_id FROM channels WHERE id = $1',
      [channelId]
    );
    if (channel.rows[0]?.owner_id === userId) {
      return true;
    }

    const manager = await db.query(
      'SELECT * FROM channel_managers WHERE channel_id = $1 AND telegram_user_id = $2 AND is_active = TRUE',
      [channelId, telegramUserId]
    );
    return manager.rows.length > 0;
  }
}
