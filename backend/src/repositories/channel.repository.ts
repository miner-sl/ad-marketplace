import { PoolClient } from 'pg';
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
  topic_id?: number;
  ad_format?: string;
  search?: string;
  ownerId?: number;
  status?: 'active' | 'inactive' | 'moderation';
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
   * Batch fetch channel basic info by IDs (solves N+1 query problem)
   */
  static async findBasicInfoByIds(channelIds: number[]): Promise<Map<number, ChannelInfo>> {
    if (channelIds.length === 0) {
      return new Map();
    }

    const result = await db.query(
      `SELECT id, title, username, telegram_channel_id FROM channels WHERE id = ANY($1::int[])`,
      [channelIds]
    );

    const channelMap = new Map<number, ChannelInfo>();
    for (const channel of result.rows || []) {
      channelMap.set(channel.id, channel);
    }

    return channelMap;
  }

  /**
   * Get channel by ID within an existing transaction
   */
  static async findByIdWithClient(client: PoolClient, channelId: number): Promise<{ id: number; owner_id: number } | null> {
    const result = await client.query(
      'SELECT id, owner_id FROM channels WHERE id = $1',
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
   * List channels with filters (subscribers, price, ad_format)
   * Returns channels grouped by id with pricing array
   */
  static async listChannelsWithFilters(filters: ChannelListFilters): Promise<any[]> {
    const {
      min_subscribers,
      max_subscribers,
      min_price,
      max_price,
      topic_id,
      ad_format, // TODO support multiple formats selected ad_formats: AdFormat[]
      search,
      ownerId,
      status,
      limit = 50,
      offset = 0,
    } = filters;

    let query = `
      SELECT DISTINCT c.*, cs.subscribers_count, cs.average_views
      FROM channels c
      LEFT JOIN LATERAL (
        SELECT * FROM channel_stats 
        WHERE channel_id = c.id 
        ORDER BY stats_date DESC 
        LIMIT 1
      ) cs ON true
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramCount = 1;

    if (ownerId === undefined && status === undefined) {
      query += ` AND c.is_active = TRUE`;
    }
    if (topic_id) {
      query += ` AND c.topic_id = $${paramCount++}`;
      params.push(topic_id);
    }

    if (min_subscribers !== undefined) {
      query += ` AND cs.subscribers_count >= $${paramCount++}`;
      params.push(min_subscribers);
    }
    if (max_subscribers !== undefined) {
      query += ` AND cs.subscribers_count <= $${paramCount++}`;
      params.push(max_subscribers);
    }

    if (search && search.trim() !== '') {
      query += ` AND (
        c.title ILIKE $${paramCount} OR 
        c.username ILIKE $${paramCount}
      )`;
      params.push(`%${search.trim()}%`);
      paramCount++;
    }

    if (ownerId !== undefined) {
      query += ` AND c.owner_id = $${paramCount++}`;
      params.push(ownerId);
    }

    if (status) {
      switch (status) {
        case 'active':
          query += ` AND c.is_active = TRUE`;
          break;
        case 'inactive':
          query += ` AND c.is_active = FALSE`;
          break;
        case 'moderation':
          // Moderation means not verified - adjust based on your business logic
          query += ` AND c.is_verified = FALSE`;
          break;
      }
    }

    const pricingConditions: string[] = [];
    pricingConditions.push(`cp_filter.ad_format = $${paramCount++}`);
    params.push('post');
    if (min_price !== undefined) {
      pricingConditions.push(`cp_filter.price_ton >= $${paramCount++}`);
      params.push(min_price);
    }
    if (max_price !== undefined) {
      pricingConditions.push(`cp_filter.price_ton <= $${paramCount++}`);
      params.push(max_price);
    }

    if (pricingConditions.length > 0) {
      query += ` AND EXISTS (
        SELECT 1 FROM channel_pricing cp_filter 
        WHERE cp_filter.channel_id = c.id 
        AND cp_filter.is_active = TRUE
        AND ${pricingConditions.join(' AND ')}
      )`;
    }

    query += ` ORDER BY c.created_at DESC LIMIT $${paramCount++} OFFSET $${paramCount++}`;
    params.push(limit, offset);

    const channelsResult = await db.query(query, params);
    const channels = channelsResult?.rows || [];

    if (channels.length === 0) {
      return [];
    }

    const channelIds = channels.map((c: any) => c.id);
    const pricingQuery = `
      SELECT cp.*
      FROM channel_pricing cp
      WHERE cp.channel_id = ANY($1::int[])
      AND cp.is_active = TRUE
      ORDER BY cp.channel_id, cp.ad_format
    `;
    const pricingResult = await db.query(pricingQuery, [channelIds]);
    const allPricing = pricingResult?.rows || [];

    const pricingMap = new Map<number, any[]>();
    for (const pricing of allPricing) {
      const channelId = pricing.channel_id;
      if (!pricingMap.has(channelId)) {
        pricingMap.set(channelId, []);
      }
      pricingMap.get(channelId)!.push({
        id: pricing.id,
        channel_id: pricing.channel_id,
        ad_format: pricing.ad_format,
        price_ton: parseFloat(pricing.price_ton),
        currency: pricing.currency,
        is_active: pricing.is_active,
        created_at: pricing.created_at,
        updated_at: pricing.updated_at,
      });
    }

    return channels.map((channel: any) => ({
      ...channel,
      pricing: pricingMap.get(channel.id) || [],
    }));
  }

  /**
   * Get channel details with stats and pricing
   */
  static async findByIdWithDetails(channelId: number): Promise<any | null> {
    const result = await db.query(
      `SELECT c.*, cs.*
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

    const channel = result.rows[0];

    const pricingResult = await db.query(
      `SELECT 
        id,
        channel_id,
        ad_format,
        price_ton,
        currency,
        is_active,
        created_at,
        updated_at
       FROM channel_pricing 
       WHERE channel_id = $1`,
      [channelId]
    );

    channel.pricing = pricingResult?.rows || [];

    return channel;
  }
}
