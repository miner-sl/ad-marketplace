import db from '../db/connection';
import { PoolClient } from 'pg';
import { withTx } from '../utils/transaction';
import { Creative } from '../models/creative.types';

export class CreativeRepository {
  /**
   * Get latest creative for deal
   */
  static async findByDeal(dealId: number): Promise<Creative | null> {
    const result = await db.query(
      `SELECT * FROM creatives 
       WHERE deal_id = $1 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [dealId]
    );
    if (!result?.rows || result.rows.length === 0) {
      return null;
    }
    return result.rows[0] || null;
  }

  /**
   * Create a new creative
   */
  static async create(data: {
    deal_id: number;
    submitted_by: number;
    content_type: string;
    content_data: Record<string, any>;
  }): Promise<Creative> {
    return await withTx(async (client: PoolClient) => {
      return await this.createWithClient(client, data);
    });
  }

  /**
   * Create a new creative within an existing transaction
   */
  static async createWithClient(
    client: PoolClient,
    data: {
      deal_id: number;
      submitted_by: number;
      content_type: string;
      content_data: Record<string, any>;
    }
  ): Promise<Creative> {
    const result = await client.query(
      `INSERT INTO creatives (deal_id, submitted_by, content_type, content_data)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [data.deal_id, data.submitted_by, data.content_type, JSON.stringify(data.content_data)]
    );

    if (result.rows.length === 0) {
      throw new Error(`Failed to create creative for Deal #${data.deal_id}`);
    }

    return result.rows[0];
  }

  /**
   * Submit a creative (change status from draft to submitted)
   */
  static async submit(dealId: number): Promise<Creative> {
    return await withTx(async (client: PoolClient) => {
      return await this.submitWithClient(client, dealId);
    });
  }

  /**
   * Submit a creative within an existing transaction
   */
  static async submitWithClient(client: PoolClient, dealId: number): Promise<Creative> {
    const result = await client.query(
      `UPDATE creatives 
       SET status = 'submitted', updated_at = CURRENT_TIMESTAMP
       WHERE deal_id = $1 AND status = 'draft'
       RETURNING *`,
      [dealId]
    );

    if (result.rows.length === 0) {
      throw new Error(`Creative for Deal #${dealId} not found or not in draft status`);
    }

    return result.rows[0];
  }

  /**
   * Approve a creative
   */
  static async approve(dealId: number): Promise<Creative> {
    return await withTx(async (client: PoolClient) => {
      return await this.approveWithClient(client, dealId);
    });
  }

  /**
   * Approve a creative within an existing transaction
   */
  static async approveWithClient(client: PoolClient, dealId: number): Promise<Creative> {
    const result = await client.query(
      `UPDATE creatives 
       SET status = 'approved', updated_at = CURRENT_TIMESTAMP
       WHERE deal_id = $1
       RETURNING *`,
      [dealId]
    );

    if (result.rows.length === 0) {
      throw new Error(`Creative for Deal #${dealId} not found`);
    }

    return result.rows[0];
  }

  /**
   * Reject a creative (set status to needs_revision with notes)
   */
  static async reject(dealId: number, notes: string): Promise<Creative> {
    return await withTx(async (client: PoolClient) => {
      return await this.rejectWithClient(client, dealId, notes);
    });
  }

  /**
   * Reject a creative within an existing transaction
   */
  static async rejectWithClient(client: PoolClient, dealId: number, notes: string): Promise<Creative> {
    const result = await client.query(
      `UPDATE creatives 
       SET status = 'needs_revision', revision_notes = $1, updated_at = CURRENT_TIMESTAMP
       WHERE deal_id = $2
       RETURNING *`,
      [notes, dealId]
    );

    if (result.rows.length === 0) {
      throw new Error(`Creative for Deal #${dealId} not found`);
    }

    return result.rows[0];
  }

  /**
   * Request revision of a creative within an existing transaction
   */
  static async requestRevisionWithClient(client: PoolClient, dealId: number, notes: string): Promise<Creative> {
    const creativeResult = await client.query(
      `SELECT * FROM creatives WHERE deal_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [dealId]
    );

    if (!creativeResult.rows || creativeResult.rows.length === 0) {
      throw new Error(`Cannot request revision: Creative for Deal #${dealId} not found. Please submit a creative first.`);
    }

    return await this.rejectWithClient(client, dealId, notes);
  }
}
