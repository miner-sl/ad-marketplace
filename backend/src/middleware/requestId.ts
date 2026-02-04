import { FastifyRequest, FastifyReply } from 'fastify';
import { randomBytes } from 'crypto';

declare module 'fastify' {
  interface FastifyRequest {
    requestId?: string;
  }
}

/**
 * Fastify plugin to add request ID for tracing
 */
export async function requestIdPlugin(
  fastify: any,
) {
  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const requestId = randomBytes(16).toString('hex');
    request.requestId = requestId;
    reply.header('X-Request-ID', requestId);
  });
}
