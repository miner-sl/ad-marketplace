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

export class ChannelRepository {
  /**
   * Get channel owner ID by channel ID
   */
  static async getOwnerId(channelId: number): Promise<number | null> {
    const result = await db.query(
      'SELECT owner_id FROM channels WHERE id = $1',
      [channelId]
    );
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
    return result.rows;
  }

  /**
   * Get channel telegram_channel_id by channel ID
   */
  static async getTelegramChannelId(channelId: number): Promise<number | null> {
    const result = await db.query(
      'SELECT telegram_channel_id FROM channels WHERE id = $1',
      [channelId]
    );
    return result.rows[0]?.telegram_channel_id || null;
  }
}
