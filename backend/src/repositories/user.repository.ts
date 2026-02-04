import db from '../db/connection';
import { withTx } from '../utils/transaction';
import { User } from '../models/user.types';

export class UserModel {
  static async findByTelegramId(telegramId: number): Promise<User | null> {
    const result = await db.query(
      'SELECT * FROM users WHERE telegram_id = $1',
      [telegramId]
    );
    if (!result?.rows || result.rows.length === 0) {
      return null;
    }
    return result.rows[0] || null;
  }

  static async findById(id: number): Promise<User | null> {
    const result = await db.query(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );
    if (!result?.rows || result.rows.length === 0) {
      return null;
    }
    return result.rows[0] || null;
  }

  static async create(data: {
    telegram_id: number;
    username?: string;
    first_name?: string;
    last_name?: string;
    photo_url?: string;
    language_code?: string;
    is_premium?: boolean;
  }): Promise<User> {
    return await withTx(async (client) => {
      const result = await client.query(
        `INSERT INTO users (telegram_id, username, first_name, last_name, photo_url, language_code, is_premium)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          data.telegram_id, 
          data.username, 
          data.first_name, 
          data.last_name,
          data.photo_url,
          data.language_code,
          data.is_premium ?? false,
        ]
      );
      
      if (result.rows.length === 0) {
        throw new Error(`Failed to create user with telegram_id: ${data.telegram_id}`);
      }
      
      return result.rows[0];
    });
  }

  static async update(data: {
    telegram_id: number;
    username?: string;
    first_name?: string;
    last_name?: string;
    photo_url?: string;
    language_code?: string;
    is_premium?: boolean;
  }): Promise<User> {
    return await withTx(async (client) => {
      const updateFields: string[] = [];
      const updateValues: any[] = [];
      let paramCount = 1;

      if (data.username !== undefined) {
        updateFields.push(`username = $${paramCount++}`);
        updateValues.push(data.username);
      }
      if (data.first_name !== undefined) {
        updateFields.push(`first_name = $${paramCount++}`);
        updateValues.push(data.first_name);
      }
      if (data.last_name !== undefined) {
        updateFields.push(`last_name = $${paramCount++}`);
        updateValues.push(data.last_name);
      }
      if (data.photo_url !== undefined) {
        updateFields.push(`photo_url = $${paramCount++}`);
        updateValues.push(data.photo_url);
      }
      if (data.language_code !== undefined) {
        updateFields.push(`language_code = $${paramCount++}`);
        updateValues.push(data.language_code);
      }
      if (data.is_premium !== undefined) {
        updateFields.push(`is_premium = $${paramCount++}`);
        updateValues.push(data.is_premium);
      }

      updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
      updateValues.push(data.telegram_id);

      if (updateFields.length === 1) {
        // Only updated_at
        const result = await client.query(
          `UPDATE users SET updated_at = CURRENT_TIMESTAMP
           WHERE telegram_id = $1
           RETURNING *`,
          [data.telegram_id]
        );
        return result.rows[0];
      }

      const result = await client.query(
        `UPDATE users 
         SET ${updateFields.join(', ')}
         WHERE telegram_id = $${paramCount}
         RETURNING *`,
        updateValues
      );

      if (result.rows.length === 0) {
        throw new Error(`User with telegram_id ${data.telegram_id} not found`);
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

  static async findOrCreateWithRoles(data: {
    telegram_id: number;
    username?: string;
    first_name?: string;
    last_name?: string;
    is_channel_owner?: boolean;
    is_advertiser?: boolean;
  }): Promise<User> {
    return await withTx(async (client) => {
      // Lock or check for existing user atomically
      const existing = await client.query(
        `SELECT * FROM users WHERE telegram_id = $1 FOR UPDATE`,
        [data.telegram_id]
      );
      
      let user: User;
      
      if (existing.rows.length > 0) {
        // Update user info and roles
        const updateFields: string[] = [];
        const updateValues: any[] = [];
        let paramCount = 1;

        if (data.username !== undefined) {
          updateFields.push(`username = $${paramCount++}`);
          updateValues.push(data.username);
        }
        if (data.first_name !== undefined) {
          updateFields.push(`first_name = $${paramCount++}`);
          updateValues.push(data.first_name);
        }
        if (data.last_name !== undefined) {
          updateFields.push(`last_name = $${paramCount++}`);
          updateValues.push(data.last_name);
        }
        if (data.is_channel_owner !== undefined) {
          updateFields.push(`is_channel_owner = $${paramCount++}`);
          updateValues.push(data.is_channel_owner);
        }
        if (data.is_advertiser !== undefined) {
          updateFields.push(`is_advertiser = $${paramCount++}`);
          updateValues.push(data.is_advertiser);
        }

        updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
        updateValues.push(data.telegram_id);

        if (updateFields.length === 1) {
          // Only updated_at, no other fields to update
          const result = await client.query(
            `UPDATE users 
             SET updated_at = CURRENT_TIMESTAMP
             WHERE telegram_id = $1
             RETURNING *`,
            [data.telegram_id]
          );
          user = result.rows[0];
        } else {
          const result = await client.query(
            `UPDATE users 
             SET ${updateFields.join(', ')}
             WHERE telegram_id = $${paramCount}
             RETURNING *`,
            updateValues
          );
          user = result.rows[0];
        }
      } else {
        // Create new user with roles
        const result = await client.query(
          `INSERT INTO users (telegram_id, username, first_name, last_name, is_channel_owner, is_advertiser)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING *`,
          [
            data.telegram_id,
            data.username,
            data.first_name,
            data.last_name,
            data.is_channel_owner ?? false,
            data.is_advertiser ?? false,
          ]
        );
        
        if (result.rows.length === 0) {
          throw new Error(`Failed to create user with telegram_id: ${data.telegram_id}`);
        }
        
        user = result.rows[0];
      }
      
      return user;
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
