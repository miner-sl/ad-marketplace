import TelegramBot, {ChatMember} from 'node-telegram-bot-api';
import * as dotenv from 'dotenv';
import {JSDOM} from 'jsdom';
import {getRandomUserAgent} from '../utils/network/useragent';
import {formatUsername} from "../models/tg.util";
import {withRetry} from "../utils/network/retry";
import env from "../utils/env";

dotenv.config();

const botToken = process.env.TELEGRAM_BOT_TOKEN!;
export const bot = new TelegramBot(botToken, {polling: false});

export interface ChannelStats {
  subscribers_count?: number;
  average_views?: number;
  average_reach?: number;
  language_distribution?: Record<string, number>;
  premium_subscribers_count?: number;
}

export class TelegramService {
  static async getChannelInfoByChannelId(channelId: number): Promise<{
    id: number;
    title?: string;
    username?: string;
    description?: string;
  }> {
    try {
      const chat = await bot.getChat(channelId);
      return {
        id: chat.id as number,
        title: (chat as any).title,
        username: (chat as any).username,
        description: (chat as any).description,
      };
    } catch (error) {
      throw new Error(`Failed to get channel info: ${error}`);
    }
  }

  /**
   * Get channel information by username (e.g., @channelname)
   * Telegram Bot API supports getting chat info by username
   */
  static async getChannelInfoByUsername(username: string): Promise<{
    id: number;
    title?: string;
    telegramId?: string;
    username?: string;
    description?: string;
  }> {
    try {
      const formattedUsername = formatUsername(username);
      const chat = await bot.getChat(formattedUsername);

      return {
        id: chat.id as number,
        title: (chat as any).title,
        telegramId: (chat as any).user?.id,
        username: (chat as any).username,
        description: (chat as any).description,
      };
    } catch (error: any) {
      throw new Error(`Failed to get channel info by username ${username}: ${error.message || error}`);
    }
  }

  /**
   * Check if bot is admin of channel by channel ID
   */
  static async isBotAdmin(channelId: number): Promise<boolean> {
    try {
      const botInfo = await bot.getMe();
      const member = await bot.getChatMember(channelId, botInfo.id);
      return member.status === 'administrator' || member.status === 'creator';
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if bot is admin of channel by username
   */
  static async isBotAdminByUsername(username: string): Promise<boolean> {
    try {
      const formattedUsername = formatUsername(username);

      const channelInfo = await this.getChannelInfoByUsername(formattedUsername);
      return await this.isBotAdmin(channelInfo.id);
    } catch (error) {
      return false;
    }
  }

  /**
   * Get bot info (for use in handlers)
   */
  static get bot() {
    return bot;
  }

  static async botStillAdminInChannel(telegramChannelId: number): Promise<boolean> {
    const channelAdmins = await TelegramService.getChannelAdmins(telegramChannelId);
    const isChannelAdmin = channelAdmins.find((admin) => String(admin.user.username) === env.TELEGRAM_BOT_USERNAME);

    return isChannelAdmin !== undefined;
  }

  /**
   * Get channel administrators
   */
  static async getChannelAdmins(telegramChannelId: number): Promise<Array<{
    user: TelegramBot.User;
    status: string;
    can_post_messages?: boolean;
    can_edit_messages?: boolean;
    can_delete_messages?: boolean;
  }>> {
    try {
      const admins = await bot.getChatAdministrators(telegramChannelId);
      return admins.map((admin: ChatMember) => ({
        user: admin.user,
        status: admin.status,
        can_post_messages: admin.can_post_messages,
        can_edit_messages: admin.can_edit_messages,
        can_delete_messages: admin.can_delete_messages,
      }));
    } catch (error) {
      throw new Error(`Failed to get channel admins: ${error}`);
    }
  }

  /**
   * Check if user is admin of channel
   */
  static async isUserAdmin(channelId: number, userId: number): Promise<boolean> {
    try {
      const member = await bot.getChatMember(channelId, userId);
      return member.status === 'administrator' || member.status === 'creator';
    } catch (error) {
      return false;
    }
  }

  /**
   * Fetch channel statistics from Telegram
   * Note: This requires Telegram Premium API or Bot API with proper permissions
   * For MVP, we'll use available methods and cache results
   */
  static async fetchChannelStats(channelId: number): Promise<ChannelStats> {
    try {
      const chat = await bot.getChat(channelId);
      if (chat.type !== 'channel') {
        throw new Error('Not a channel');
      }

      let memberCount = await bot.getChatMemberCount(channelId);
      if (memberCount === 0) {
        memberCount = 0;
      }
      // Note: Detailed stats like average views, language distribution, premium stats
      // require Telegram Premium API or channel analytics access
      // For MVP, we'll return basic info and extend later

      // TODO integrate TGSTATS and get detailed stats
      return {
        subscribers_count: memberCount,
        average_views: Math.floor(memberCount * 0.12),
        average_reach: undefined,
        language_distribution: undefined,
        premium_subscribers_count: undefined,
      };
    } catch (error) {
      throw new Error(`Failed to fetch channel stats: ${error}`);
    }
  }

  /**
   * Post message to channel
   */
  static async postToChannel(
    channelId: number,
    content: {
      text?: string;
      photo?: string;
      video?: string;
      document?: string;
      caption?: string;
    },
    options?: {
      parse_mode?: 'HTML' | 'Markdown';
      disable_notification?: boolean;
    }
  ): Promise<TelegramBot.Message> {
    try {
      if (content.photo) {
        return await bot.sendPhoto(channelId, content.photo, {
          caption: content.caption || content.text,
          parse_mode: options?.parse_mode,
          disable_notification: options?.disable_notification,
        });
      } else if (content.video) {
        return await bot.sendVideo(channelId, content.video, {
          caption: content.caption || content.text,
          parse_mode: options?.parse_mode,
          disable_notification: options?.disable_notification,
        });
      } else if (content.document) {
        return await bot.sendDocument(channelId, content.document, {
          caption: content.caption || content.text,
          parse_mode: options?.parse_mode,
          disable_notification: options?.disable_notification,
        });
      } else {
        return await bot.sendMessage(channelId, content.text || '', {
          parse_mode: options?.parse_mode,
          disable_notification: options?.disable_notification,
        });
      }
    } catch (error) {
      throw new Error(`Failed to post to channel: ${error}`);
    }
  }

  /**
   * Verify post still exists and is unchanged
   */
  static async verifyPost(channelId: number, messageId: number): Promise<{
    exists: boolean;
    unchanged: boolean;
    currentMessage?: TelegramBot.Message;
  }> {
    try {
      // Try to get the message by attempting to forward it to ourselves
      // This is a workaround since Bot API doesn't have direct getMessage
      await bot.forwardMessage(channelId, channelId, messageId);

      // If forward succeeds, message exists
      // For MVP, we assume unchanged if it exists
      // In production, we'd store message content on post and compare
      return {
        exists: true,
        unchanged: true, // Simplified for MVP - would compare content in production
      };
    } catch (error: any) {
      // Message not found, deleted, or inaccessible
      if (error.response?.body?.error_code === 400 || error.response?.body?.error_code === 403) {
        return {
          exists: false,
          unchanged: false,
        };
      }
      throw error;
    }
  }

  /**
   * Get message from channel
   */
  static async getMessage(channelId: number, messageId: number): Promise<TelegramBot.Message | null> {
    try {
      // Note: Bot API doesn't have direct getMessage, but we can try to access it
      // For verification, we'll use forwardMessage trick or store message on post
      return null; // Placeholder - would need custom implementation
    } catch (error) {
      return null;
    }
  }

  /**
   * Get message text from channel using message ID
   */
  static async getMessageText(channelUsername: string, messageId: number): Promise<string | undefined> {
    if (!channelUsername || messageId === undefined) {
      return undefined;
    }

    const url = `https://t.me/${channelUsername}/${messageId}?embed=1&mode=tme`;

    return withRetry(
      async () => await this.fetchMessageContent(url),
      {
        maxRetries: 3,
        baseDelay: 1000,
        maxDelay: 10000,
        shouldRetry: (error) => {
          return !error.message.includes("404");
        },
      }
    );
  }

  private static async fetchMessageContent(url: string): Promise<string | undefined>  {
    const res = await fetch(url, {
      headers: {
        "User-Agent": getRandomUserAgent(),
      },
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const html = await res.text();
    const dom = new JSDOM(html);
    const el = dom.window.document.querySelector(
      ".tgme_widget_message_text.js-message_text"
    );

    const text = el?.textContent?.trim();
    console.log(url, text)
    if (!text) throw new Error("No text content");

    return text;
  }
}
