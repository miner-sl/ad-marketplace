import db from '../db/connection';
import { withTx } from '../utils/transaction';

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
    return await withTx(async (client) => {
      const result = await client.query(
        `INSERT INTO users (telegram_id, username, first_name, last_name)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [data.telegram_id, data.username, data.first_name, data.last_name]
      );
      
      if (result.rows.length === 0) {
        throw new Error(`Failed to create user with telegram_id: ${data.telegram_id}`);
      }
      
      return result.rows[0];
    });
  }

  static async findOrCreate(data: {
    telegram_id: number;
    username?: string;
    first_name?: string;
    last_name?: string;
  }): Promise<User> {
    return await withTx(async (client) => {
      // Lock or check for existing user atomically
      const existing = await client.query(
        `SELECT * FROM users WHERE telegram_id = $1 FOR UPDATE`,
        [data.telegram_id]
      );
      
      if (existing.rows.length > 0) {
        // Update user info if changed
        const result = await client.query(
          `UPDATE users 
           SET username = $1, first_name = $2, last_name = $3, updated_at = CURRENT_TIMESTAMP
           WHERE telegram_id = $4
           RETURNING *`,
          [data.username, data.first_name, data.last_name, data.telegram_id]
        );
        return result.rows[0];
      }
      
      // Create new user
      const result = await client.query(
        `INSERT INTO users (telegram_id, username, first_name, last_name)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [data.telegram_id, data.username, data.first_name, data.last_name]
      );
      
      if (result.rows.length === 0) {
        throw new Error(`Failed to create user with telegram_id: ${data.telegram_id}`);
      }
      
      return result.rows[0];
    });
  }

  static async updateRole(
    telegramId: number,
    role: 'channel_owner' | 'advertiser',
    value: boolean
  ): Promise<User> {
    return await withTx(async (client) => {
      const field = role === 'channel_owner' ? 'is_channel_owner' : 'is_advertiser';
      const result = await client.query(
        `UPDATE users SET ${field} = $1, updated_at = CURRENT_TIMESTAMP
         WHERE telegram_id = $2
         RETURNING *`,
        [value, telegramId]
      );
      
      if (result.rows.length === 0) {
        throw new Error(`User with telegram_id ${telegramId} not found`);
      }
      
      return result.rows[0];
    });
  }

  static async updateWalletAddress(telegramId: number, walletAddress: string): Promise<User> {
    return await withTx(async (client) => {
      const result = await client.query(
        `UPDATE users SET wallet_address = $1, updated_at = CURRENT_TIMESTAMP
         WHERE telegram_id = $2
         RETURNING *`,
        [walletAddress, telegramId]
      );
      
      if (result.rows.length === 0) {
        throw new Error(`User with telegram_id ${telegramId} not found`);
      }
      
      return result.rows[0];
    });
  }

  /**
   * Batch fetch users by IDs (solves N+1 query problem)
   */
  static async findByIds(userIds: number[]): Promise<Map<number, User>> {
    if (userIds.length === 0) {
      return new Map();
    }

    const result = await db.query(
      `SELECT * FROM users WHERE id = ANY($1::int[])`,
      [userIds]
    );

    const userMap = new Map<number, User>();
    for (const user of result.rows || []) {
      userMap.set(user.id, user);
    }

    return userMap;
  }
}
