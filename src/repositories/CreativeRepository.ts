import db from '../db/connection';

export interface Creative {
  id: number;
  deal_id: number;
  submitted_by: number;
  content_type: string;
  content_data: Record<string, any>;
  status: string;
  revision_notes?: string;
  created_at: Date;
  updated_at: Date;
}

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
    return result.rows[0] || null;
  }
}
