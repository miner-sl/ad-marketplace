import { Router } from 'express';
import { UserModel } from '../models/User';
import { validateQuery } from '../middleware/validation';
import { z } from 'zod';

const userRouter = Router();

const getUserMeQuerySchema = z.object({
  telegram_id: z.string().regex(/^\d+$/).transform(Number),
});

// Get current user info
userRouter.get('/me', validateQuery(getUserMeQuerySchema), async (req, res) => {
  try {
    const telegram_id = req.query.telegram_id as unknown as number;
    
    const user = await UserModel.findByTelegramId(telegram_id);
    
    if (!user) {
      return res.json({
        registered: false,
        user: null,
      });
    }

    // Return user info without sensitive data
    res.json({
      registered: true,
      user: {
        id: user.id,
        telegram_id: user.telegram_id,
        username: user.username,
        first_name: user.first_name,
        last_name: user.last_name,
        is_channel_owner: user.is_channel_owner,
        is_advertiser: user.is_advertiser,
        created_at: user.created_at,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Register/update user
userRouter.post('/register', async (req, res) => {
  try {
    const {
      telegram_id,
      username,
      first_name,
      last_name,
      is_channel_owner,
      is_advertiser,
    } = req.body;

    if (!telegram_id) {
      return res.status(400).json({ error: 'telegram_id is required' });
    }

    const updatedUser = await UserModel.findOrCreateWithRoles({
      telegram_id: Number(telegram_id),
      username,
      first_name,
      last_name,
      is_channel_owner: is_channel_owner !== undefined ? Boolean(is_channel_owner) : undefined,
      is_advertiser: is_advertiser !== undefined ? Boolean(is_advertiser) : undefined,
    });

    res.json({
      registered: true,
      user: {
        id: updatedUser.id,
        telegram_id: updatedUser.telegram_id,
        username: updatedUser.username,
        first_name: updatedUser.first_name,
        last_name: updatedUser.last_name,
        is_channel_owner: updatedUser.is_channel_owner,
        is_advertiser: updatedUser.is_advertiser,
        created_at: updatedUser.created_at,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default userRouter;
