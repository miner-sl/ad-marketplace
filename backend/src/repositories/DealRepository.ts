import db from '../db/connection';

export interface DealMessage {
  id: number;
  deal_id: number;
  sender_id: number;
  message_text: string;
  created_at: Date;
}

export interface DealListFilters {
  status?: string;
  deal_type?: string;
  limit?: number;
}

export class DealRepository {
  /**
   * List deals with filters (status, deal_type)
   */
  static async listDealsWithFilters(filters: DealListFilters): Promise<any[]> {
    const { status, deal_type, limit = 100 } = filters;

    const result = await db.query(
      `SELECT * FROM deals 
       WHERE ($1::text IS NULL OR status = $1)
       AND ($2::text IS NULL OR deal_type = $2)
       ORDER BY created_at DESC
       LIMIT $3`,
      [status || null, deal_type || null, limit]
    );
    return result?.rows || [];
  }

  /**
   * Get pending deals for channel owner
   */
  static async findPendingForChannelOwner(ownerId: number, limit: number = 20): Promise<any[]> {
    const result = await db.query(
      `SELECT d.* FROM deals d
       INNER JOIN channels c ON d.channel_id = c.id
       WHERE c.owner_id = $1 AND d.status = 'pending'
       ORDER BY d.created_at DESC
       LIMIT $2`,
      [ownerId, limit]
    );
    return result?.rows || [];
  }

  /**
   * Get deal messages ordered by creation time
   */
  static async getMessages(dealId: number): Promise<DealMessage[]> {
    const result = await db.query(
      'SELECT * FROM deal_messages WHERE deal_id = $1 ORDER BY created_at ASC',
      [dealId]
    );
    return result?.rows || [];
  }

  /**
   * Get first message (brief) for deal
   */
  static async getBrief(dealId: number): Promise<string | null> {
    const result = await db.query(
      `SELECT message_text FROM deal_messages WHERE deal_id = $1 ORDER BY created_at ASC LIMIT 1`,
      [dealId]
    );
    if (!result?.rows || result.rows.length === 0) {
      return null;
    }
    return result.rows[0]?.message_text || null;
  }

  /**
   * Get channel info for deal
   */
  static async getChannelInfoForDeal(dealId: number): Promise<{
    id: number;
    title?: string;
    username?: string;
    telegram_channel_id?: number;
  } | null> {
    const result = await db.query(
      `SELECT c.id, c.title, c.username, c.telegram_channel_id 
       FROM channels c
       INNER JOIN deals d ON c.id = d.channel_id
       WHERE d.id = $1`,
      [dealId]
    );
    if (!result?.rows || result.rows.length === 0) {
      return null;
    }
    return result.rows[0] || null;
  }
}
