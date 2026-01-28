import db from '../db/connection';

export interface ChannelListing {
  id: number;
  channel_id: number;
  title?: string;
  description?: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export class ChannelListingModel {
  static async create(data: {
    channel_id: number;
    title?: string;
    description?: string;
  }): Promise<ChannelListing> {
    const result = await db.query(
      `INSERT INTO channel_listings (channel_id, title, description)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [data.channel_id, data.title, data.description]
    );
    return result.rows[0];
  }

  static async findById(id: number): Promise<ChannelListing | null> {
    const result = await db.query('SELECT * FROM channel_listings WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  static async findByChannel(channelId: number): Promise<ChannelListing[]> {
    const result = await db.query(
      'SELECT * FROM channel_listings WHERE channel_id = $1 ORDER BY created_at DESC',
      [channelId]
    );
    return result.rows;
  }

  static async update(id: number, data: Partial<ChannelListing>): Promise<ChannelListing> {
    const updates: string[] = [];
    const params: any[] = [];
    let paramCount = 1;

    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && key !== 'id' && key !== 'created_at') {
        updates.push(`${key} = $${paramCount++}`);
        params.push(value);
      }
    });

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    const query = `UPDATE channel_listings SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;
    const result = await db.query(query, params);
    return result.rows[0];
  }
}
