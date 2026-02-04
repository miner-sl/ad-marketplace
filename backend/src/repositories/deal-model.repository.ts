import db from '../db/connection';
import { withTx } from '../utils/transaction';
import { Deal, DealStatus, DealType } from '../models/deal.types';

export class DealModel {
  static async create(data: {
    deal_type: DealType;
    listing_id?: number;
    campaign_id?: number;
    channel_id: number;
    channel_owner_id: number;
    advertiser_id: number;
    ad_format: string;
    price_ton: number;
    escrow_address?: string;
    timeout_hours?: number;
  }): Promise<Deal> {
    return await withTx(async (client) => {
      const timeoutHours = data.timeout_hours || 72;
      // Create date in UTC
      const timeoutAt = new Date();
      timeoutAt.setUTCHours(timeoutAt.getUTCHours() + timeoutHours);
      // Convert to ISO string to ensure UTC format
      const utcTimeoutAt = new Date(timeoutAt.toISOString());

      const result = await client.query(
        `INSERT INTO deals (
          deal_type, listing_id, campaign_id, channel_id, channel_owner_id,
          advertiser_id, ad_format, price_ton, escrow_address, timeout_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *`,
        [
          data.deal_type,
          data.listing_id,
          data.campaign_id,
          data.channel_id,
          data.channel_owner_id,
          data.advertiser_id,
          data.ad_format,
          data.price_ton,
          data.escrow_address,
          utcTimeoutAt,
        ]
      );
      return result.rows[0];
    });
  }

  static async findById(id: number): Promise<Deal | null> {
    const result = await db.query('SELECT * FROM deals WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  static async findByIdWithChannel(id: number): Promise<any | null> {
    const result = await db.query(
      `SELECT 
        d.*,
        c.id as c_id,
        c.owner_id as c_owner_id,
        c.telegram_channel_id as c_telegram_channel_id,
        c.username as c_username,
        c.title as c_title,
        c.description as c_description,
        c.topic_id as c_topic_id,
        c.bot_admin_id as c_bot_admin_id,
        c.is_verified as c_is_verified,
        c.is_active as c_is_active,
        c.created_at as c_created_at,
        c.updated_at as c_updated_at,
        t.id as t_id,
        t.name as t_name,
        t.description as t_description
      FROM deals d
      LEFT JOIN channels c ON d.channel_id = c.id
      LEFT JOIN topics t ON c.topic_id = t.id
      WHERE d.id = $1`,
      [id]
    );

    if (!result.rows || result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];

    // Extract deal fields (all columns that don't start with 'c_' or 't_')
    const deal: any = {};
    const channel: any = {};
    const topic: any = {};

    for (const key in row) {
      if (key.startsWith('c_')) {
        const channelKey = key.replace('c_', '');
        channel[channelKey] = row[key];
      } else if (key.startsWith('t_')) {
        const topicKey = key.replace('t_', '');
        topic[topicKey] = row[key];
      } else {
        deal[key] = row[key];
      }
    }

    // Only add channel if it has an id (meaning the join found a channel)
    if (channel.id) {
      // Add topic to channel if topic exists
      if (topic.id) {
        channel.topic = topic;
      }
      deal.channel = channel;
    }

    return deal;
  }

  static async findByUser(userId: number, status?: string): Promise<Deal[]> {
    let query = `SELECT * FROM deals 
       WHERE (channel_owner_id = $1 OR advertiser_id = $1)`;
    const params: any[] = [userId];

    if (status) {
      query += ` AND status = $2`;
      params.push(status);
    }

    query += ` ORDER BY created_at DESC`;

    const result = await db.query(query, params);
    return result.rows;
  }

  static async updateStatus(id: number, status: DealStatus): Promise<Deal> {
    return await withTx(async (client) => {
      const row = await client.query(
        `SELECT * FROM deals WHERE id = $1 FOR UPDATE`,
        [id]
      );

      if (row.rows.length === 0) {
        throw new Error(`Deal #${id} not found`);
      }
      const result = await client.query(
        `UPDATE deals SET status = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING *`,
        [status, id]
      );

      if (result.rows.length === 0) {
        throw new Error(`Deal #${id} not found`);
      }

      return result.rows[0];
    });
  }

  static async confirmPayment(id: number, txHash: string): Promise<Deal> {
    return await withTx(async (client) => {
      // Lock deal row to prevent race conditions
      const dealCheck = await client.query(
        `SELECT * FROM deals WHERE id = $1 FOR UPDATE`,
        [id]
      );

      if (dealCheck.rows.length === 0) {
        throw new Error(`Deal #${id} not found`);
      }

      const deal = dealCheck.rows[0];

      // Idempotency check: if payment already confirmed, return existing deal
      if (deal.payment_tx_hash && deal.status !== 'payment_pending') {
        const logger = (await import('../utils/logger')).default;
        logger.info(`Payment already confirmed for Deal #${id}`, {
          dealId: id,
          existingTxHash: deal.payment_tx_hash,
          currentStatus: deal.status,
        });
        return deal;
      }

      // Check status atomically
      if (deal.status !== 'payment_pending') {
        throw new Error(`Cannot confirm payment in status: ${deal.status}`);
      }

      // Atomic update: check both status AND payment_tx_hash IS NULL
      const result = await client.query(
        `UPDATE deals 
         SET status = 'paid', payment_tx_hash = $1, payment_confirmed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2 AND status = 'payment_pending' AND payment_tx_hash IS NULL
         RETURNING *`,
        [txHash, id]
      );

      if (result.rows.length === 0) {
        // Payment was confirmed by another process - re-query to get current state
        const recheck = await client.query(
          `SELECT * FROM deals WHERE id = $1`,
          [id]
        );
        if (recheck.rows.length > 0 && recheck.rows[0].payment_tx_hash) {
          const logger = (await import('../utils/logger')).default;
          logger.info(`Payment was confirmed by another process for Deal #${id}`, {
            dealId: id,
            existingTxHash: recheck.rows[0].payment_tx_hash,
          });
          return recheck.rows[0];
        }
        throw new Error(`Deal #${id} status changed during payment confirmation`);
      }

      return result.rows[0];
    });
  }

  static async schedulePost(id: number, postTime: Date): Promise<Deal> {
    return await withTx(async (client) => {
      // Lock deal row to prevent race conditions
      const dealCheck = await client.query(
        `SELECT * FROM deals WHERE id = $1 FOR UPDATE`,
        [id]
      );

      if (dealCheck.rows.length === 0) {
        throw new Error('Deal not found');
      }

      const deal = dealCheck.rows[0];

      // Check status atomically
      if (deal.status !== 'paid' && deal.status !== 'scheduled') {
        throw new Error(`Cannot schedule post in status: ${deal.status}`);
      }

      // Ensure date is in UTC (convert to ISO string and back to ensure UTC)
      const utcDate = new Date(postTime.toISOString());

      // Atomic update with status check
      const result = await client.query(
        `UPDATE deals 
         SET status = 'scheduled', scheduled_post_time = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2 AND status IN ('paid', 'scheduled')
         RETURNING *`,
        [utcDate, id]
      );

      if (result.rows.length === 0) {
        throw new Error('Deal status changed during processing');
      }

      return result.rows[0];
    });
  }

  static async recordPost(id: number, messageId: number, verificationUntil: Date): Promise<Deal> {
    return await withTx(async (client) => {
      // Lock deal row to prevent race conditions
      const dealCheck = await client.query(
        `SELECT * FROM deals WHERE id = $1 FOR UPDATE`,
        [id]
      );

      if (dealCheck.rows.length === 0) {
        throw new Error(`Deal #${id} not found`);
      }

      // Ensure date is in UTC (convert to ISO string and back to ensure UTC)
      const utcDate = new Date(verificationUntil.toISOString());

      const result = await client.query(
        `UPDATE deals 
         SET status = 'posted', actual_post_time = CURRENT_TIMESTAMP, 
             post_message_id = $1, post_verification_until = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3
         RETURNING *`,
        [messageId, utcDate, id]
      );

      if (result.rows.length === 0) {
        throw new Error(`Failed to record post for Deal #${id}`);
      }

      return result.rows[0];
    });
  }

  static async markVerified(id: number): Promise<Deal> {
    return await withTx(async (client) => {
      const result = await client.query(
        `UPDATE deals 
         SET status = 'verified', updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND status = 'posted'
         RETURNING *`,
        [id]
      );

      if (result.rows.length === 0) {
        throw new Error(`Deal #${id} not found or not in 'posted' status`);
      }

      return result.rows[0];
    });
  }

  static async markCompleted(id: number): Promise<Deal> {
    return await withTx(async (client) => {
      const result = await client.query(
        `UPDATE deals 
         SET status = 'completed', updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND status IN ('verified', 'posted')
         RETURNING *`,
        [id]
      );

      if (result.rows.length === 0) {
        throw new Error(`Deal #${id} not found or not in valid status for completion`);
      }

      return result.rows[0];
    });
  }

  static async cancel(id: number, reason?: string): Promise<Deal> {
    return await withTx(async (client) => {
      const dealCheck = await client.query(
        `SELECT * FROM deals WHERE id = $1 FOR UPDATE`,
        [id]
      );

      if (dealCheck.rows.length === 0) {
        throw new Error(`Deal #${id} not found`);
      }

      const deal = dealCheck.rows[0];

      // Only allow cancellation in certain statuses
      const cancellableStatuses = ['pending', 'negotiating', 'payment_pending'];
      if (!cancellableStatuses.includes(deal.status)) {
        throw new Error(`Cannot cancel deal in status: ${deal.status}`);
      }

      const result = await client.query(
        `UPDATE deals 
         SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND status IN ('pending', 'negotiating', 'payment_pending')
         RETURNING *`,
        [id]
      );

      if (result.rows.length === 0) {
        throw new Error(`Deal #${id} status changed during cancellation`);
      }

      return result.rows[0];
    });
  }

  static async findExpiredDeals(): Promise<Deal[]> {
    const result = await db.query(
      `SELECT * FROM deals 
       WHERE timeout_at < CURRENT_TIMESTAMP 
       AND status IN ('pending', 'negotiating', 'payment_pending')
       ORDER BY timeout_at ASC`
    );
    return result.rows;
  }

  static async findDealsReadyForVerification(): Promise<Deal[]> {
    const result = await db.query(
      `SELECT * FROM deals 
       WHERE status = 'posted' 
       AND post_verification_until < CURRENT_TIMESTAMP`
    );
    return result.rows;
  }

  /**
   * Find verified deals that need automatic release (buyer didn't confirm)
   * After VERIFIED_TIMEOUT_HOURS, automatically release funds
   */
  static async findVerifiedDealsForAutoRelease(limit: number = 100): Promise<Deal[]> {
    const timeoutHours = parseInt(process.env.VERIFIED_TIMEOUT_HOURS || '168', 10); // 7 days default
    const result = await db.query(
      `SELECT * FROM deals 
       WHERE status = 'verified' 
       AND post_verification_until < CURRENT_TIMESTAMP - INTERVAL '1 hour' * $1
       ORDER BY post_verification_until ASC
       LIMIT $2`,
      [timeoutHours, limit]
    );
    return result.rows;
  }
}
