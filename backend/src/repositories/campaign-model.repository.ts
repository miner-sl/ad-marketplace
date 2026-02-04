import db from '../db/connection';

export interface Campaign {
  id: number;
  advertiser_id: number;
  title: string;
  description?: string;
  budget_ton?: number;
  target_subscribers_min?: number;
  target_subscribers_max?: number;
  target_views_min?: number;
  target_languages?: string[];
  preferred_formats?: string[];
  status: string;
  created_at: Date;
  updated_at: Date;
}

export class CampaignModel {
  static async findById(id: number): Promise<Campaign | null> {
    const result = await db.query('SELECT * FROM campaigns WHERE id = $1', [id]);
    if (!result?.rows || result.rows.length === 0) {
      return null;
    }
    return result.rows[0] || null;
  }

  static async findByAdvertiser(advertiserId: number): Promise<Campaign[]> {
    const result = await db.query(
      'SELECT * FROM campaigns WHERE advertiser_id = $1 ORDER BY created_at DESC',
      [advertiserId]
    );
    return result.rows || [];
  }

  static async update(id: number, data: {
    title?: string;
    description?: string;
    budget_ton?: number;
    target_subscribers_min?: number;
    target_subscribers_max?: number;
    status?: string;
  }): Promise<Campaign> {
    const updates: string[] = [];
    const params: any[] = [];
    let paramCount = 1;

    if (data.title) {
      updates.push(`title = $${paramCount++}`);
      params.push(data.title);
    }
    if (data.description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      params.push(data.description);
    }
    if (data.budget_ton !== undefined) {
      updates.push(`budget_ton = $${paramCount++}`);
      params.push(data.budget_ton);
    }
    if (data.target_subscribers_min !== undefined) {
      updates.push(`target_subscribers_min = $${paramCount++}`);
      params.push(data.target_subscribers_min);
    }
    if (data.target_subscribers_max !== undefined) {
      updates.push(`target_subscribers_max = $${paramCount++}`);
      params.push(data.target_subscribers_max);
    }
    if (data.status) {
      updates.push(`status = $${paramCount++}`);
      params.push(data.status);
    }

    if (updates.length === 0) {
      const existing = await this.findById(id);
      if (!existing) {
        throw new Error(`Campaign #${id} not found`);
      }
      return existing;
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(id);

    const query = `UPDATE campaigns SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;
    const result = await db.query(query, params);
    
    if (!result?.rows || result.rows.length === 0) {
      throw new Error(`Campaign #${id} not found`);
    }
    
    return result.rows[0];
  }
}
