import db from '../db/connection';

export interface Creative {
  id: number;
  deal_id: number;
  submitted_by: number;
  content_type: string;
  content_data: Record<string, any>;
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'needs_revision';
  revision_notes?: string;
  created_at: Date;
  updated_at: Date;
}

export class CreativeService {
  static async create(data: {
    deal_id: number;
    submitted_by: number;
    content_type: string;
    content_data: Record<string, any>;
  }): Promise<Creative> {
    const result = await db.query(
      `INSERT INTO creatives (deal_id, submitted_by, content_type, content_data)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [data.deal_id, data.submitted_by, data.content_type, JSON.stringify(data.content_data)]
    );
    return result.rows[0];
  }

  static async findByDeal(dealId: number): Promise<Creative | null> {
    const result = await db.query(
      `SELECT * FROM creatives 
       WHERE deal_id = $1 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [dealId]
    );
    return result.rows[0] || null;
  }

  static async submit(dealId: number): Promise<Creative> {
    const result = await db.query(
      `UPDATE creatives 
       SET status = 'submitted', updated_at = CURRENT_TIMESTAMP
       WHERE deal_id = $1 AND status = 'draft'
       RETURNING *`,
      [dealId]
    );
    return result.rows[0];
  }

  static async approve(dealId: number): Promise<Creative> {
    const result = await db.query(
      `UPDATE creatives 
       SET status = 'approved', updated_at = CURRENT_TIMESTAMP
       WHERE deal_id = $1
       RETURNING *`,
      [dealId]
    );
    return result.rows[0];
  }

  static async reject(dealId: number, notes: string): Promise<Creative> {
    const result = await db.query(
      `UPDATE creatives 
       SET status = 'needs_revision', revision_notes = $1, updated_at = CURRENT_TIMESTAMP
       WHERE deal_id = $2
       RETURNING *`,
      [notes, dealId]
    );
    return result.rows[0];
  }

  static async requestRevision(dealId: number, notes: string): Promise<Creative> {
    return this.reject(dealId, notes);
  }
}
