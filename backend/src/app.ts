import Fastify from 'fastify';
import * as path from 'path';
import YAML from 'yamljs';

import channelsRouter from './routes/channels.route';
import dealsRouter from './routes/deals.route';
import campaignsRouter from './routes/campaigns.route';
import userRouter from './routes/user.route';
import authRouter from './routes/auth.route';
import bot from './bot';
import logger from './utils/logger';
import env from './utils/env';
import { requestIdPlugin } from './middleware/requestId';
import db from './db/connection';

const isProd = env.NODE_ENV === 'production';

export async function buildApp() {
  const app = Fastify({
    logger: false, // We use winston for logging
    requestIdLogLabel: 'requestId',
    requestIdHeader: 'X-Request-ID',
    bodyLimit: 10 * 1024 * 1024, // 10MB
  });

  // Register request ID plugin
  await app.register(requestIdPlugin);

  // Register CORS
  await app.register(require('@fastify/cors'), {
    origin: isProd
      ? process.env.ALLOWED_ORIGINS?.split(',') || false
      : true,
  });

  // Register Helmet for security
  await app.register(require('@fastify/helmet'), {
    contentSecurityPolicy: isProd ? undefined : false,
  });

  // Rate limiting will be registered for /api routes only

  // Request logging hook
  app.addHook('onRequest', async (request, reply) => {
    logger.debug('Incoming request', {
      method: request.method,
      path: request.url,
      requestId: request.requestId,
      ip: request.ip,
    });
  });

  // Health check endpoints
  app.get('/health', async (request) => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      requestId: request.requestId,
    };
  });

  app.get('/ready', async (request, reply) => {
    try {
      await db.query('SELECT 1');
      return {
        status: 'ready',
        timestamp: new Date().toISOString(),
        database: 'connected',
        requestId: request.requestId,
      };
    } catch (error: any) {
      logger.error('Readiness check failed', { error: error.message, requestId: request.requestId });
      reply.code(503);
      return {
        status: 'not ready',
        database: 'disconnected',
        requestId: request.requestId,
      };
    }
  });

  // Liveness check
  app.get('/live', async (request) => {
    return {
      status: 'alive',
      timestamp: new Date().toISOString(),
      requestId: request.requestId,
    };
  });

  // Swagger documentation
  const swaggerDocument = YAML.load(path.join(__dirname, '../swagger.yaml')) as any;
  await app.register(require('@fastify/swagger'), {
    openapi: {
      openapi: swaggerDocument.openapi || '3.0.0',
      info: swaggerDocument.info,
      servers: swaggerDocument.servers,
      paths: swaggerDocument.paths,
      components: swaggerDocument.components,
    },
  });
  
  await app.register(require('@fastify/swagger-ui'), {
    routePrefix: '/api-docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false,
    },
    staticCSP: true,
    transformStaticCSP: (header: any) => header,
  });

  // Auth routes (no rate limiting for login endpoints)
  await app.register(authRouter, { prefix: '/api/auth' });

  // API routes with rate limiting
  await app.register(async function (fastify) {
    // Register rate limiting for all routes in this scope (/api)
    await fastify.register(require('@fastify/rate-limit'), {
      max: isProd ? 100 : 1000,
      timeWindow: '15 minutes',
      addHeaders: {
        'x-ratelimit-limit': true,
        'x-ratelimit-remaining': true,
        'x-ratelimit-reset': true,
      },
    });

    // Register route handlers
    await fastify.register(channelsRouter, { prefix: '/channels' });
    await fastify.register(dealsRouter, { prefix: '/deals' });
    await fastify.register(campaignsRouter, { prefix: '/campaigns' });
    await fastify.register(userRouter, { prefix: '/user' });
  }, { prefix: '/api' });

  // Webhook for Telegram bot
  app.post('/webhook', async (request, reply) => {
    try {
      await bot.handleUpdate(request.body as any);
      reply.code(200).send();
    } catch (error: any) {
      logger.error('Webhook error', {
        error: error.message,
        stack: error.stack,
        requestId: request.requestId,
      });
      reply.code(500).send({
        error: 'Webhook processing failed',
        requestId: request.requestId,
      });
    }
  });

  // Error handler
  app.setErrorHandler((error, request, reply) => {
    const status = error.statusCode || 500;
    const message = error.message || 'Internal server error';

    logger.error('Request error', {
      error: message,
      stack: error.stack,
      status,
      method: request.method,
      path: request.url,
      requestId: request.requestId,
    });

    reply.status(status).send({
      error: isProd && status === 500
        ? 'Internal server error'
        : message,
      requestId: request.requestId,
      ...(env.NODE_ENV !== 'production' && { stack: error.stack }),
    });
  });

  return app;
}
