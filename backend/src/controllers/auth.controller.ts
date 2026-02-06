import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authService } from '../services/auth.service';
import { telegramAuthService } from '../services/telegram-auth.service';
import logger from '../utils/logger';

const telegramWidgetAuthSchema = z.object({
  id: z.number(),
  first_name: z.string(),
  last_name: z.string().optional(),
  username: z.string().optional(),
  photo_url: z.string().optional(),
  language_code: z.string().optional(),
  is_premium: z.boolean().optional(),
  auth_date: z.number(),
  hash: z.string(),
});

const telegramWebAppAuthSchema = z.object({
  initData: z.string(),
});

export class AuthController {
  static async loginWithTelegramWidget(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = telegramWidgetAuthSchema.parse(request.body);

      const validatedUser = telegramAuthService.validateWidgetAuth(body);

      const result = await authService.loginWithTelegramWidget(validatedUser);

      return result;
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          error: 'Validation failed',
          details: error.errors,
        });
      }

      logger.error('Telegram widget auth failed', {
        error: error.message,
        stack: error.stack,
      });

      return reply.code(401).send({
        error: 'Authentication failed',
        message: error.message || 'Invalid Telegram auth data',
      });
    }
  }

  static async loginWithTelegramWebApp(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = telegramWebAppAuthSchema.parse(request.body);

      const validatedData = telegramAuthService.validateWebAppInitData(body.initData);

      const result = await authService.loginWithTelegramMiniApp(validatedData);

      return result;
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          error: 'Validation failed',
          details: error.errors,
        });
      }

      logger.error('Telegram webapp auth failed', {
        error: error.message,
        stack: error.stack,
      });

      return reply.code(401).send({
        error: 'Authentication failed',
        message: error.message || 'Invalid Telegram init data',
      });
    }
  }

  static async logout(request: FastifyRequest, reply: FastifyReply) {
    // In stateless JWT, logout is handled client-side by discarding the token
    // Server doesn't need to do anything
    return { success: true };
  }

  static async getCurrentUser(request: FastifyRequest, reply: FastifyReply) {
    try {
      if (!request.user) {
        return reply.code(401).send({
          error: 'Unauthorized',
        });
      }

      const user = await authService.getUser(request.user.id);

      if (!user) {
        return reply.code(404).send({
          error: 'User not found',
        });
      }

      return {
        id: user.id.toString(),
        username: user.username,
        telegramId: user.telegram_id,
        firstName: user.first_name,
        lastName: user.last_name,
        photoUrl: user.photo_url,
        languageCode: user.language_code,
        isPremium: user.is_premium,
        isChannelOwner: user.is_channel_owner,
        isAdvertiser: user.is_advertiser,
        createdAt: user.created_at,
      };
    } catch (error: any) {
      logger.error('Get user failed', {
        error: error.message,
        userId: request.user?.id,
      });

      return reply.code(500).send({
        error: 'Internal server error',
      });
    }
  }
}
