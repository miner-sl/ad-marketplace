import { FastifyRequest, FastifyReply } from 'fastify';
import { UserModel } from '../repositories/user.repository';
import logger from '../utils/logger';

export class UserController {
  static async getCurrentUser(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { telegram_id } = request.query as any;
      
      const user = await UserModel.findByTelegramId(telegram_id);
      
      if (!user) {
        return {
          registered: false,
          user: null,
        };
      }

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
      logger.error('Failed to get current user', {
        error: error.message,
        stack: error.stack,
      });
      reply.code(500).send({ error: error.message });
    }
  }

  static async registerUser(request: FastifyRequest, reply: FastifyReply) {
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
      logger.error('Failed to register user', {
        error: error.message,
        stack: error.stack,
      });
      reply.code(500).send({ error: error.message });
    }
  }
}
