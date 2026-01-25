import { Request, Response, NextFunction } from 'express';
import { randomBytes } from 'crypto';

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

/**
 * Middleware to add request ID for tracing
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const requestId = randomBytes(16).toString('hex');
  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
}
