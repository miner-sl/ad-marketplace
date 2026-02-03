import { FastifyPluginAsync } from 'fastify';
import { authService } from '../services/auth';
import { telegramAuthService } from '../services/telegramAuth';
import { authMiddleware } from '../middleware/auth';
import { z } from 'zod';
import logger from '../utils/logger';

// Validation schemas
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

const authRouter: FastifyPluginAsync = async (fastify) => {
  // Login with Telegram widget
  fastify.post('/telegram/widget', async (request, reply) => {
    try {
      const body = telegramWidgetAuthSchema.parse(request.body);
      
      // Validate Telegram auth data
      const validatedUser = telegramAuthService.validateWidgetAuth(body);
      
      // Login and get JWT token
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
  });

  // Login with Telegram Mini App (Web App)
  fastify.post('/telegram/webapp', async (request, reply) => {
    try {
      const body = telegramWebAppAuthSchema.parse(request.body);
      
      // Validate Web App init data
      const validatedData = telegramAuthService.validateWebAppInitData(body.initData);
      
      // Login and get JWT token
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
  });

  // Logout (client should discard token)
  fastify.post('/logout', {
    preHandler: [authMiddleware],
  }, async (request, reply) => {
    // In stateless JWT, logout is handled client-side by discarding the token
    // Server doesn't need to do anything
    return { success: true };
  });

  // Get current user info
  fastify.get('/me', {
    preHandler: [authMiddleware],
  }, async (request, reply) => {
    try {
      if (!request.user) {
        return reply.code(401).send({
          error: 'Unauthorized',
        });
      }

      const user = await authService.validateUser(request.user.id);
      
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
  });
};

export default authRouter;
