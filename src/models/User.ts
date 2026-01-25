import db from '../db/connection';

export interface User {
  id: number;
  telegram_id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  wallet_address?: string;
  is_channel_owner: boolean;
  is_advertiser: boolean;
  created_at: Date;
  updated_at: Date;
}

export class UserModel {
  static async findByTelegramId(telegramId: number): Promise<User | null> {
    const result = await db.query(
      'SELECT * FROM users WHERE telegram_id = $1',
      [telegramId]
    );
    return result.rows[0] || null;
  }

  static async findById(id: number): Promise<User | null> {
    const result = await db.query(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  static async create(data: {
    telegram_id: number;
    username?: string;
    first_name?: string;
    last_name?: string;
  }): Promise<User> {
    const result = await db.query(
      `INSERT INTO users (telegram_id, username, first_name, last_name)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [data.telegram_id, data.username, data.first_name, data.last_name]
    );
    return result.rows[0];
  }

  static async findOrCreate(data: {
    telegram_id: number;
    username?: string;
    first_name?: string;
    last_name?: string;
  }): Promise<User> {
    console.log(data);
    const existing = await this.findByTelegramId(data.telegram_id);
    if (existing) {
      // Update user info if changed
      const result = await db.query(
        `UPDATE users 
         SET username = $1, first_name = $2, last_name = $3, updated_at = CURRENT_TIMESTAMP
         WHERE telegram_id = $4
         RETURNING *`,
        [data.username, data.first_name, data.last_name, data.telegram_id]
      );
      return result.rows[0];
    }
    return this.create(data);
  }

  static async updateRole(
    telegramId: number,
    role: 'channel_owner' | 'advertiser',
    value: boolean
  ): Promise<User> {
    const field = role === 'channel_owner' ? 'is_channel_owner' : 'is_advertiser';
    const result = await db.query(
      `UPDATE users SET ${field} = $1, updated_at = CURRENT_TIMESTAMP
       WHERE telegram_id = $2
       RETURNING *`,
      [value, telegramId]
    );
    return result.rows[0];
  }

  static async updateWalletAddress(telegramId: number, walletAddress: string): Promise<User> {
    const result = await db.query(
      `UPDATE users SET wallet_address = $1, updated_at = CURRENT_TIMESTAMP
       WHERE telegram_id = $2
       RETURNING *`,
      [walletAddress, telegramId]
    );
    return result.rows[0];
  }
}
