import jwt, { SignOptions } from 'jsonwebtoken';
import env from './env';
import logger from './logger';

export interface JwtPayload {
  sub: string; // User ID
  username: string;
  telegramId?: number;
}

/**
 * Create a JWT access token for a user
 * @param userId - User ID
 * @param username - Username (falls back to tg_<telegramId> if not provided)
 * @param telegramId - Optional Telegram ID
 * @returns Signed JWT token string
 */
export function createAccessToken(
  userId: number,
  username: string | undefined,
  telegramId?: number
): string {
  const payload: JwtPayload = {
    sub: userId.toString(),
    username: username || `tg_${telegramId}`,
    telegramId,
  };

  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN || '7D',
  } as SignOptions);
}

/**
 * Validate JWT token
 * @param token - JWT token string to validate
 * @returns Decoded JWT payload
 * @throws Error if token is invalid or expired
 */
export function validateToken(token: string): JwtPayload {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    return payload;
  } catch (error: any) {
    logger.warn('Invalid JWT token', { error: error.message });
    throw new Error('Invalid token');
  }
}
