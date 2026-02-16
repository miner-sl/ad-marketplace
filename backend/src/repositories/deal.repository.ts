import {PoolClient} from 'pg';
import db from '../db/connection';
import {Deal} from "../models/deal.types";

export interface DealMessage {
  id: number;
  deal_id: number;
  sender_id: number;
  message_text: string;
  created_at: Date;
}

export type DealScheduledDTO = Deal & { telegram_channel_id: number, channel_owner_id: number }

export interface DealListFilters {
  status?: string;
  deal_type?: string;
  limit?: number;
}

export class DealRepository {
  static async findDealsNeedingEscrow(limit: number = 20): Promise<Deal[]> {
    const result = await db.query(
      `SELECT * FROM deals 
       WHERE status IN ('pending', 'negotiating', 'payment_pending')
       AND escrow_address IS NULL
       ORDER BY created_at ASC
       LIMIT $1`,
      [limit]
    );
    return result.rows || [];
  }

  /**
   * List deals with filters (status, deal_type)
   */
  static async listDealsWithFilters(filters: DealListFilters): Promise<Deal[]> {
    const {status, deal_type, limit = 100} = filters;

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

  /** Allowed statuses for "pending" deals list */
  static readonly PENDING_DEAL_STATUSES = ['pending', 'negotiating', 'payment_pending'] as const;

  /**
   * Get pending deals for channel owner (optionally filtered; with pagination and total count)
   */
  static async findPendingForChannelOwner(
    ownerId: number,
    options: {
      limit?: number;
      page?: number;
      channelId?: number | null;
      statuses?: (typeof DealRepository.PENDING_DEAL_STATUSES)[number][] | null;
      dateFrom?: string | null; // ISO date, filter by d.created_at
      dateTo?: string | null;
      country?: string | null; // reserved, no column yet
      locale?: string | null; // advertiser language_code
      premiumOnly?: boolean | null;
    } = {}
  ): Promise<{ rows: any[]; allAmount: number }> {
    const {
      limit = 20,
      page = 1,
      channelId,
      statuses,
      dateFrom,
      dateTo,
      locale,
      premiumOnly,
    } = options;
    const filterByChannel = typeof channelId === 'number' && Number.isFinite(channelId);
    const filterByStatus = Array.isArray(statuses) && statuses.length > 0;
    const filterByDateFrom = typeof dateFrom === 'string' && dateFrom.length > 0;
    const filterByDateTo = typeof dateTo === 'string' && dateTo.length > 0;
    const filterByLocale = typeof locale === 'string' && locale.length > 0;
    const filterByPremium = premiumOnly === true;
    const needAdvertiserJoin = filterByLocale || filterByPremium;
    const offset = Math.max(0, (Math.max(1, page) - 1) * limit);

    const params: (number | string | string[] | boolean)[] = [ownerId];
    const conditions: string[] = ['c.owner_id = $1'];

    if (filterByChannel) {
      params.push(channelId!);
      conditions.push(`d.channel_id = $${params.length}`);
    }
    if (filterByStatus) {
      params.push(statuses!);
      conditions.push(`d.status = ANY($${params.length})`);
    } else {
      conditions.push("(d.status = 'pending' OR d.status = 'negotiating' OR d.status = 'payment_pending')");
    }
    if (filterByDateFrom) {
      params.push(dateFrom);
      conditions.push(`d.created_at >= $${params.length}::timestamp`);
    }
    if (filterByDateTo) {
      params.push(dateTo);
      conditions.push(`d.created_at <= $${params.length}::timestamp`);
    }
    if (needAdvertiserJoin) {
      if (filterByLocale) {
        params.push(locale);
        conditions.push(`u.language_code = $${params.length}`);
      }
      if (filterByPremium) {
        conditions.push('u.is_premium = true');
      }
    }

    params.push(limit, offset);
    const limitIdx = params.length - 1;
    const offsetIdx = params.length;

    const joinClause = needAdvertiserJoin
      ? ' INNER JOIN users u ON d.advertiser_id = u.id'
      : '';
    let sql = `SELECT d.*, COUNT(*) OVER() AS all_amount FROM deals d
     INNER JOIN channels c ON d.channel_id = c.id${joinClause}
     WHERE ${conditions.join(' AND ')}
     ORDER BY d.created_at DESC
     LIMIT $${limitIdx} OFFSET $${offsetIdx}`;

    const result = await db.query(
      sql,
      params
    );
    const rows = result?.rows || [];
    const allAmount = rows.length > 0 ? Number(rows[0].all_amount) : 0;
    const rowsWithoutCount = rows.map(({all_amount, ...r}) => r);
    return {rows: rowsWithoutCount, allAmount: allAmount};
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
   * Batch fetch briefs for multiple deals (solves N+1 query problem)
   */
  static async findBriefsByDealIds(dealIds: number[]): Promise<Map<number, string>> {
    if (dealIds.length === 0) {
      return new Map();
    }

    const result = await db.query(
      `SELECT DISTINCT ON (dm.deal_id) dm.deal_id, dm.message_text 
       FROM deal_messages dm
       WHERE dm.deal_id = ANY($1::int[]) 
       ORDER BY dm.deal_id, dm.created_at ASC`,
      [dealIds]
    );

    const briefMap = new Map<number, string>();
    for (const row of result.rows || []) {
      briefMap.set(row.deal_id, row.message_text);
    }

    return briefMap;
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

  /**
   * Batch fetch channels by IDs (solves N+1 query problem)
   */
  static async findChannelsByIds(channelIds: number[]): Promise<Map<number, {
    id: number;
    telegram_channel_id?: number
  }>> {
    if (channelIds.length === 0) {
      return new Map();
    }

    const result = await db.query(
      `SELECT id, telegram_channel_id FROM channels WHERE id = ANY($1::int[])`,
      [channelIds]
    );

    const channelMap = new Map<number, { id: number; telegram_channel_id?: number }>();
    for (const channel of result.rows || []) {
      channelMap.set(channel.id, channel);
    }

    return channelMap;
  }

  /**
   * Get deals ready for auto-post with channel info (optimized query)
   * Finds deals that are scheduled and ready to be published
   */
  static async findPendingScheduledPosts(limit: number = 100): Promise<DealScheduledDTO[]> {
    const result = await db.query(
      `SELECT d.*, c.telegram_channel_id, c.owner_id as channel_owner_id
       FROM deals d
       INNER JOIN channels c ON d.channel_id = c.id
       WHERE d.status IN ('scheduled', 'paid', 'creative_approved')
       AND d.scheduled_post_time IS NOT NULL
       AND d.scheduled_post_time <= NOW()
       AND d.post_message_id IS NULL
       ORDER BY d.scheduled_post_time ASC
       LIMIT $1`,
      [limit]
    );
    return result?.rows || [];
  }

  /**
   * Get deals ready for verification with channel info (optimized query)
   * @param limit - Maximum number of deals to return
   */
  static async findDealsReadyForVerificationWithChannels(limit: number = 100): Promise<any[]> {
    const result = await db.query(
      `SELECT d.*, c.username, c.telegram_channel_id
       FROM deals d
       INNER JOIN channels c ON d.channel_id = c.id
       WHERE (d.status = 'posted' or d.status = 'scheduled') 
       AND d.post_verification_until < CURRENT_TIMESTAMP
       ORDER BY d.post_verification_until ASC
       LIMIT $1`,
      [limit]
    );
    return result?.rows || [];
  }

  /**
   * Add deal message within an existing transaction
   */
  static async addMessageWithClient(
    client: PoolClient,
    dealId: number,
    senderId: number,
    messageText: string
  ): Promise<void> {
    await client.query(
      `INSERT INTO deal_messages (deal_id, sender_id, message_text)
       VALUES ($1, $2, $3)`,
      [dealId, senderId, messageText]
    );
  }

  /**
   * Find latest message by sender within an existing transaction
   */
  static async findLatestMessageBySenderWithClient(
    client: PoolClient,
    dealId: number,
    senderId: number
  ): Promise<{ id: number } | null> {
    const result = await client.query(
      `SELECT id FROM deal_messages 
       WHERE deal_id = $1 AND sender_id = $2 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [dealId, senderId]
    );
    return result.rows[0] || null;
  }

  /**
   * Update deal message within an existing transaction
   */
  static async updateMessageWithClient(
    client: PoolClient,
    messageId: number,
    dealId: number,
    senderId: number,
    messageText: string
  ): Promise<DealMessage> {
    const result = await client.query(
      `UPDATE deal_messages 
       SET message_text = $1 
       WHERE id = $2 AND deal_id = $3 AND sender_id = $4
       RETURNING *`,
      [messageText, messageId, dealId, senderId]
    );

    if (result.rows.length === 0) {
      throw new Error('Failed to update message');
    }

    return result.rows[0];
  }

  /**
   * Update deal status to pending within an existing transaction
   */
  static async updateDealStatusToPendingWithClient(
    client: PoolClient,
    dealId: number
  ): Promise<void> {
    await client.query(
      `UPDATE deals 
       SET status = 'pending', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [dealId]
    );
  }
}
