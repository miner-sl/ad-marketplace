import db from '../db/connection';
import { Campaign } from '../models/Campaign';

export interface CampaignListFilters {
  advertiser_id?: number;
  status?: string;
  min_budget?: number;
  max_budget?: number;
  limit?: number;
  offset?: number;
}

export interface CampaignCreateData {
  advertiser_id: number;
  title: string;
  description?: string;
  budget_ton?: number;
  target_subscribers_min?: number;
  target_subscribers_max?: number;
  target_views_min?: number;
  target_languages?: string[];
  preferred_formats?: string[];
}

export interface CampaignUpdateData {
  title?: string;
  description?: string;
  budget_ton?: number;
  target_subscribers_min?: number;
  target_subscribers_max?: number;
  status?: string;
}

export class CampaignRepository {
  /**
   * List campaigns with filters
   */
  static async listCampaignsWithFilters(filters: CampaignListFilters): Promise<Campaign[]> {
    const {
      advertiser_id,
      status,
      min_budget,
      max_budget,
      limit = 50,
      offset = 0,
    } = filters;

    let query = 'SELECT * FROM campaigns WHERE 1=1';
    const params: any[] = [];
    let paramCount = 1;

    if (advertiser_id !== undefined) {
      query += ` AND advertiser_id = $${paramCount++}`;
      params.push(advertiser_id);
    }
    if (status) {
      query += ` AND status = $${paramCount++}`;
      params.push(status);
    }
    if (min_budget !== undefined) {
      query += ` AND budget_ton >= $${paramCount++}`;
      params.push(min_budget);
    }
    if (max_budget !== undefined) {
      query += ` AND budget_ton <= $${paramCount++}`;
      params.push(max_budget);
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramCount++} OFFSET $${paramCount++}`;
    params.push(limit, offset);

    const result = await db.query(query, params);
    return result?.rows || [];
  }

  /**
   * Get campaign by ID
   */
  static async findById(campaignId: number): Promise<Campaign | null> {
    const result = await db.query('SELECT * FROM campaigns WHERE id = $1', [campaignId]);
    if (!result?.rows || result.rows.length === 0) {
      return null;
    }
    return result.rows[0] || null;
  }

  /**
   * Create a new campaign
   */
  static async create(data: CampaignCreateData): Promise<Campaign> {
    const result = await db.query(
      `INSERT INTO campaigns (
        advertiser_id, title, description, budget_ton,
        target_subscribers_min, target_subscribers_max, target_views_min,
        target_languages, preferred_formats, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active')
      RETURNING *`,
      [
        data.advertiser_id,
        data.title,
        data.description,
        data.budget_ton ?? null,
        data.target_subscribers_min ?? null,
        data.target_subscribers_max ?? null,
        data.target_views_min ?? null,
        data.target_languages ? JSON.stringify(data.target_languages) : null,
        data.preferred_formats ? JSON.stringify(data.preferred_formats) : null,
      ]
    );
    if (!result?.rows || result.rows.length === 0) {
      throw new Error('Failed to create campaign');
    }
    return result.rows[0];
  }

  /**
   * Update campaign
   */
  static async update(campaignId: number, data: CampaignUpdateData): Promise<Campaign> {
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
      // No updates provided, return existing campaign
      const existing = await this.findById(campaignId);
      if (!existing) {
        throw new Error(`Campaign #${campaignId} not found`);
      }
      return existing;
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(campaignId);

    const query = `UPDATE campaigns SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;
    const result = await db.query(query, params);
    
    if (!result?.rows || result.rows.length === 0) {
      throw new Error(`Campaign #${campaignId} not found`);
    }
    
    return result.rows[0];
  }
}
