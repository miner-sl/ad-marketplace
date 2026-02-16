import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';

export function validateBody(schema: z.ZodSchema) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const parsed = schema.parse(request.body);
      (request as any).body = parsed;
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: error.errors,
        });
      }
      throw error;
    }
  };
}

export function validateQuery(schema: z.ZodSchema) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      request.query = schema.parse(request.query);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: error.errors,
        });
      }
      throw error;
    }
  };
}
