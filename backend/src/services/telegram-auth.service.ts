import { validateWebAppData, checkSignature } from '@grammyjs/validator';
import env from '../utils/env';

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  language_code?: string;
  is_premium?: boolean;
  auth_date: number;
  hash: string;
}

export interface WebAppInitData {
  query_id?: string;
  user?: {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
    language_code?: string;
    is_premium?: boolean;
    photo_url?: string;
  };
  auth_date: number;
  hash: string;
}

export class TelegramAuthService {
  private readonly botToken: string;
  private readonly maxAuthAge = 86400; // 24 hours in seconds

  constructor() {
    const token = env.TELEGRAM_BOT_TOKEN;
    if (!token || token === '') {
      throw new Error('TELEGRAM_BOT_TOKEN is not configured');
    }
    this.botToken = token;
  }

  /**
   * Validate Telegram widget authentication data
   * Validates signature and auth_date
   */
  validateWidgetAuth(payload: TelegramUser): TelegramUser {
    if (!this.botToken || this.botToken === '') {
      throw new Error('Bot token not configured');
    }

    // Check auth_date is not too old
    const authAge = Math.floor(Date.now() / 1000) - payload.auth_date;
    if (authAge > this.maxAuthAge) {
      throw new Error('Auth data expired');
    }

    const dataCheck: Record<string, string> = {
      id: String(payload.id),
      first_name: payload.first_name,
      auth_date: String(payload.auth_date),
      hash: payload.hash,
    };

    if (payload.last_name !== undefined && payload.last_name !== '') {
      dataCheck.last_name = payload.last_name;
    }
    if (payload.username !== undefined && payload.username !== '') {
      dataCheck.username = payload.username;
    }
    if (payload.photo_url !== undefined && payload.photo_url !== '') {
      dataCheck.photo_url = payload.photo_url;
    }
    if (payload.language_code !== undefined && payload.language_code !== '') {
      dataCheck.language_code = payload.language_code;
    }
    if (payload.is_premium !== undefined) {
      dataCheck.is_premium = String(payload.is_premium);
    }

    const isValid = checkSignature(this.botToken, dataCheck);

    if (!isValid) {
      throw new Error('Invalid Telegram auth data');
    }

    return payload;
  }

  /**
   * Validate Telegram Web App init data
   * Validates signature and parses user data
   */
  validateWebAppInitData(initDataString: string): WebAppInitData {
    if (!this.botToken || this.botToken === '') {
      throw new Error('Bot token not configured');
    }

    if (initDataString.length > 4096) {
      throw new Error('Init data too large');
    }

    const searchParams = new URLSearchParams(initDataString);

    const isValid = validateWebAppData(this.botToken, searchParams);

    if (!isValid) {
      throw new Error('Invalid Web App init data');
    }

    const userStr = searchParams.get('user');
    const authDateStr = searchParams.get('auth_date');
    const hash = searchParams.get('hash');

    if (!authDateStr || authDateStr === '' || !hash || hash === '') {
      throw new Error('Missing required fields in init data');
    }

    const authDate = parseInt(authDateStr, 10);

    const authAge = Math.floor(Date.now() / 1000) - authDate;
    if (authAge > this.maxAuthAge) {
      throw new Error('Auth data expired');
    }

    let user: WebAppInitData['user'];
    if (userStr && userStr !== '') {
      try {
        user = JSON.parse(userStr) as WebAppInitData['user'];
      } catch {
        throw new Error('Invalid user data format');
      }
    }

    const queryId = searchParams.get('query_id');
    return {
      query_id: queryId && queryId !== '' ? queryId : undefined,
      user,
      auth_date: authDate,
      hash,
    };
  }
}

export const telegramAuthService = new TelegramAuthService();
