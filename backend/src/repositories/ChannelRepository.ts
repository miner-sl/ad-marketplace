import db from '../db/connection';

export interface ChannelBasicInfo {
  id: number;
  owner_id: number;
  title?: string;
  username?: string;
  telegram_channel_id?: number;
}

export interface ChannelInfo {
  id: number;
  title?: string;
  username?: string;
  telegram_channel_id?: number;
}

export interface ChannelListFilters {
  min_subscribers?: number;
  max_subscribers?: number;
  min_price?: number;
  max_price?: number;
  ad_format?: string;
  limit?: number;
  offset?: number;
}

export class ChannelRepository {
  /**
   * Get channel owner ID by channel ID
   */
  static async getOwnerId(channelId: number): Promise<number | null> {
    const result = await db.query(
      'SELECT owner_id FROM channels WHERE id = $1',
      [channelId]
    );
    if (!result?.rows || result.rows.length === 0) {
      return null;
    }
    return result.rows[0]?.owner_id || null;
  }

  /**
   * Get channel basic info (title, username) by ID
   */
  static async getBasicInfo(channelId: number): Promise<ChannelInfo | null> {
    const result = await db.query(
      'SELECT id, title, username, telegram_channel_id FROM channels WHERE id = $1',
      [channelId]
    );
    if (!result?.rows || result.rows.length === 0) {
      return null;
    }
    return result.rows[0] || null;
  }

  /**
   * Get channel by ID
   */
  static async findById(channelId: number): Promise<ChannelBasicInfo | null> {
    const result = await db.query(
      'SELECT * FROM channels WHERE id = $1',
      [channelId]
    );
    if (!result?.rows || result.rows.length === 0) {
      return null;
    }
    return result.rows[0] || null;
  }

  /**
   * Get channels with pricing (for browsing)
   */
  static async findWithPricing(limit: number = 20): Promise<any[]> {
    const result = await db.query(
      `SELECT DISTINCT c.* FROM channels c
       INNER JOIN channel_pricing p ON c.id = p.channel_id
       WHERE c.is_active = TRUE AND p.is_active = TRUE
       ORDER BY c.created_at DESC
       LIMIT $1`,
      [limit]
    );
    return result?.rows || [];
  }

  /**
   * Get channel telegram_channel_id by channel ID
   */
  static async getTelegramChannelId(channelId: number): Promise<number | null> {
    const result = await db.query(
      'SELECT telegram_channel_id FROM channels WHERE id = $1',
      [channelId]
    );
    if (!result?.rows || result.rows.length === 0) {
      return null;
    }
    return result.rows[0]?.telegram_channel_id || null;
  }

  /**
   * List channels with filters (subscribers, price, ad_format)
   */
  static async listChannelsWithFilters(filters: ChannelListFilters): Promise<any[]> {
    const {
      min_subscribers,
      max_subscribers,
      min_price,
      max_price,
      ad_format,
      limit = 50,
      offset = 0,
    } = filters;

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

    if (min_subscribers !== undefined) {
      query += ` AND cs.subscribers_count >= $${paramCount++}`;
      params.push(min_subscribers);
    }
    if (max_subscribers !== undefined) {
      query += ` AND cs.subscribers_count <= $${paramCount++}`;
      params.push(max_subscribers);
    }
    if (ad_format) {
      query += ` AND cp.ad_format = $${paramCount++}`;
      params.push(ad_format);
    }
    if (min_price !== undefined) {
      query += ` AND cp.price_ton >= $${paramCount++}`;
      params.push(min_price);
    }
    if (max_price !== undefined) {
      query += ` AND cp.price_ton <= $${paramCount++}`;
      params.push(max_price);
    }

    query += ` ORDER BY c.created_at DESC LIMIT $${paramCount++} OFFSET $${paramCount++}`;
    params.push(limit, offset);

    const result = await db.query(query, params);
    return result?.rows || [];
  }

  /**
   * Get channel details with stats and pricing
   */
  static async findByIdWithDetails(channelId: number): Promise<any | null> {
    const result = await db.query(
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
      [channelId]
    );
    if (!result?.rows || result.rows.length === 0) {
      return null;
    }
    return result.rows[0] || null;
  }
}
