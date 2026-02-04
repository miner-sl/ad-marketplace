import jwt, {SignOptions} from 'jsonwebtoken';
import { UserModel, User } from '../repositories/user.repository';
import {TelegramUser, WebAppInitData } from './telegram-auth.service';
import env from '../utils/env';
import logger from '../utils/logger';

export interface JwtPayload {
  sub: string; // User ID
  username: string;
  telegramId?: number;
}

export interface AuthResponse {
  user: {
    id: number;
    username?: string;
    telegramId: number;
    firstName?: string;
    lastName?: string;
    photoUrl?: string;
    languageCode?: string;
    isPremium?: boolean;
    isChannelOwner: boolean;
    isAdvertiser: boolean;
  };
  accessToken: string;
}

export class AuthService {
  /**
   * Login with Telegram widget authentication
   */
  async loginWithTelegramWidget(telegramUser: TelegramUser): Promise<AuthResponse> {
    let user = await UserModel.findByTelegramId(telegramUser.id);

    if (!user) {
      // Generate username if not provided
      const username = telegramUser.username && telegramUser.username !== ''
        ? telegramUser.username
        : `tg_${telegramUser.id}`;

      // Check if username already exists (by querying database)
      // For now, we'll use a simple approach - if username is provided and not empty, use it
      // Otherwise, use tg_<telegram_id> format which should be unique
      const finalUsername = username;

      user = await UserModel.create({
        telegram_id: telegramUser.id,
        username: finalUsername,
        first_name: telegramUser.first_name,
        last_name: telegramUser.last_name,
        photo_url: telegramUser.photo_url,
        language_code: telegramUser.language_code,
        is_premium: telegramUser.is_premium ?? false,
      });
    } else {
      await UserModel.update({
        telegram_id: telegramUser.id,
        username: telegramUser.username && telegramUser.username !== ''
          ? telegramUser.username
          : user.username,
        first_name: telegramUser.first_name,
        last_name: telegramUser.last_name,
        photo_url: telegramUser.photo_url,
        language_code: telegramUser.language_code,
        is_premium: telegramUser.is_premium ?? false,
      });
      const updatedUser = await UserModel.findByTelegramId(telegramUser.id);
      if (!updatedUser) {
        throw new Error('Failed to update user');
      }
      user = updatedUser;
    }

    const payload: JwtPayload = {
      sub: user.id.toString(),
      username: user.username || `tg_${user.telegram_id}`,
      telegramId: user.telegram_id,
    };

    const accessToken = jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN ||'7D',
    } as SignOptions);

    return {
      user: {
        id: user.id,
        username: user.username,
        telegramId: user.telegram_id,
        firstName: user.first_name,
        lastName: user.last_name,
        photoUrl: user.photo_url,
        languageCode: user.language_code,
        isPremium: user.is_premium,
        isChannelOwner: user.is_channel_owner,
        isAdvertiser: user.is_advertiser,
      },
      accessToken,
    };
  }

  /**
   * Login with Telegram Mini App (Web App)
   */
  async loginWithTelegramMiniApp(initData: WebAppInitData): Promise<AuthResponse> {
    if (!initData.user) {
      throw new Error('User data not found in init data');
    }

    const telegramUser: TelegramUser = {
      id: initData.user.id,
      first_name: initData.user.first_name,
      last_name: initData.user.last_name,
      username: initData.user.username,
      language_code: initData.user.language_code,
      is_premium: initData.user.is_premium,
      photo_url: initData.user.photo_url,
      auth_date: initData.auth_date,
      hash: initData.hash,
    };

    return await this.loginWithTelegramWidget(telegramUser);
  }

  /**
   * Validate JWT token
   */
  async validateToken(token: string): Promise<JwtPayload> {
    try {
      const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
      return payload;
    } catch (error: any) {
      logger.warn('Invalid JWT token', { error: error.message });
      throw new Error('Invalid token');
    }
  }

  /**
   * Get user by ID
   */
  async getUser(userId: number): Promise<User | null> {
    return await UserModel.findById(userId);
  }

}

export const authService = new AuthService();
