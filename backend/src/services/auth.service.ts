import { UserModel } from '../repositories/user.repository';
import { User } from '../models/user.types';
import {TelegramUser, WebAppInitData } from './telegram-auth.service';
import { createAccessToken, validateToken, JwtPayload } from '../utils/jwt';

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
      user = await UserModel.create({
        telegram_id: telegramUser.id,
        username: this.prepareTelegramUsername(telegramUser),
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

    const accessToken = createAccessToken(
      user.id,
      user.username,
      user.telegram_id
    );

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
    return validateToken(token);
  }

  /**
   * Get user by ID
   */
  async getUser(userId: number): Promise<User | null> {
    return await UserModel.findById(userId);
  }

  private prepareTelegramUsername(telegramUser: TelegramUser): string {
    const username = telegramUser.username && telegramUser.username !== ''
      ? telegramUser.username
      : `tg_${telegramUser.id}`;

    // Check if username already exists (by querying database)
    // For now, we'll use a simple approach - if username is provided and not empty, use it
    // Otherwise, use tg_<telegram_id> format which should be unique
    const finalUsername = username;
    return finalUsername;
  }

}

export const authService = new AuthService();
