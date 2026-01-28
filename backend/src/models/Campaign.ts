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
  status: 'draft' | 'active' | 'closed' | 'completed';
  created_at: Date;
  updated_at: Date;
}

export class CampaignModel {
  static async create(data: {
    advertiser_id: number;
    title: string;
    description?: string;
    budget_ton?: number;
    target_subscribers_min?: number;
    target_subscribers_max?: number;
    target_views_min?: number;
    target_languages?: string[];
    preferred_formats?: string[];
  }): Promise<Campaign> {
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
        data.budget_ton,
        data.target_subscribers_min,
        data.target_subscribers_max,
        data.target_views_min,
        data.target_languages ? JSON.stringify(data.target_languages) : null,
        data.preferred_formats ? JSON.stringify(data.preferred_formats) : null,
      ]
    );
    return result.rows[0];
  }

  static async findById(id: number): Promise<Campaign | null> {
    const result = await db.query('SELECT * FROM campaigns WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  static async findByAdvertiser(advertiserId: number): Promise<Campaign[]> {
    const result = await db.query(
      'SELECT * FROM campaigns WHERE advertiser_id = $1 ORDER BY created_at DESC',
      [advertiserId]
    );
    return result.rows;
  }

  static async update(id: number, data: Partial<Campaign>): Promise<Campaign> {
    const updates: string[] = [];
    const params: any[] = [];
    let paramCount = 1;

    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && key !== 'id' && key !== 'created_at') {
        if (key === 'target_languages' || key === 'preferred_formats') {
          updates.push(`${key} = $${paramCount++}`);
          params.push(JSON.stringify(value));
        } else {
          updates.push(`${key} = $${paramCount++}`);
          params.push(value);
        }
      }
    });

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    const query = `UPDATE campaigns SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;
    const result = await db.query(query, params);
    return result.rows[0];
  }
}
