import { FastifyRequest, FastifyReply } from 'fastify';
import { authService } from '../services/auth.service';
import logger from '../utils/logger';

declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      id: number;
      username: string;
      telegramId?: number;
    };
  }
}

/**
 * Fastify authentication middleware
 * Validates JWT token and attaches user to request
 */
export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.code(401).send({
        error: 'Unauthorized',
        message: 'Missing or invalid authorization header',
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    const payload = await authService.validateToken(token);

    request.user = {
      id: parseInt(payload.sub),
      username: payload.username,
      telegramId: payload.telegramId,
    };
  } catch (error: any) {
    logger.warn('Authentication failed', {
      error: error.message,
      path: request.url,
    });
    return reply.code(401).send({
      error: 'Unauthorized',
      message: error.message || 'Invalid token',
    });
  }
}
