import { FastifyPluginAsync } from 'fastify';
import { UserModel } from '../models/User';
import { validateQuery } from '../middleware/validation';
import { z } from 'zod';

const getUserMeQuerySchema = z.object({
  telegram_id: z.string().regex(/^\d+$/).transform(Number),
});

const userRouter: FastifyPluginAsync = async (fastify) => {
  // Get current user info
  fastify.get('/me', {
    preHandler: [validateQuery(getUserMeQuerySchema)],
  }, async (request, reply) => {
    try {
      const { telegram_id } = request.query as any;
      
      const user = await UserModel.findByTelegramId(telegram_id);
      
      if (!user) {
        return {
          registered: false,
          user: null,
        };
      }

      // Return user info without sensitive data
      return {
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
      };
    } catch (error: any) {
      reply.code(500).send({ error: error.message });
    }
  });

  // Register/update user
  fastify.post('/register', async (request, reply) => {
    try {
      const {
        telegram_id,
        username,
        first_name,
        last_name,
        is_channel_owner,
        is_advertiser,
      } = request.body as any;

      if (!telegram_id) {
        return reply.code(400).send({ error: 'telegram_id is required' });
      }

      const updatedUser = await UserModel.findOrCreateWithRoles({
        telegram_id: Number(telegram_id),
        username,
        first_name,
        last_name,
        is_channel_owner: is_channel_owner !== undefined ? Boolean(is_channel_owner) : undefined,
        is_advertiser: is_advertiser !== undefined ? Boolean(is_advertiser) : undefined,
      });

      return {
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
      };
    } catch (error: any) {
      reply.code(500).send({ error: error.message });
    }
  });
};

export default userRouter;
