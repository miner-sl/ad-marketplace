import logger from '../utils/logger';
import { TelegramService } from './telegram.service';
import { ChannelModel } from '../repositories/channel-model.repository';

export interface ChannelStatsRefreshResult {
  success: boolean;
  error?: {
    reason: string;
    message: string;
  };
}

/**
 * Service responsible for refreshing Telegram channel statistics
 * Handles the actual stats refresh logic and error classification
 */
export class TelegramChannelStatsRefreshSenderService {
  private readonly logger = logger;

  /**
   * Refresh stats for a channel
   *
   * Handles the stats refresh process, including:
   * - Fetching channel stats from Telegram
   * - Saving stats to database
   * - Error handling and classification
   *
   * @param channelId - The channel database ID
   * @param telegramChannelId - The Telegram channel ID
   * @returns Result object containing success status or error details
   */
  async refreshChannelStats(channelId: number, telegramChannelId: number): Promise<ChannelStatsRefreshResult> {
    try {
      this.logger.debug(`Refreshing stats for Channel #${channelId}`, {
        channelId,
        telegramChannelId,
      });

      const stats = await TelegramService.fetchChannelStats(telegramChannelId);
      await ChannelModel.saveStats(channelId, stats);

      this.logger.info(`Successfully refreshed stats for Channel #${channelId}`, {
        channelId,
      });

      return {
        success: true,
      };
    } catch (error: any) {
      this.logger.error(`Error refreshing stats for Channel #${channelId}`, {
        channelId,
        telegramChannelId,
        error: error.message,
        stack: error.stack,
      });

      const errorReason = this.classifyError(error);

      return {
        success: false,
        error: {
          reason: errorReason,
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  /**
   * Classify error into specific category
   * @private
   */
  private classifyError(error: unknown): string {
    if (!(error instanceof Error)) {
      return 'UnknownError';
    }

    const message = error.message.toLowerCase();

    const errorPatterns: Record<string, string> = {
      'channel not found': 'ChannelNotFound',
      'bot is not admin': 'BotNotAdmin',
      'chat not found': 'ChatNotFound',
      'network': 'NetworkError',
      'timeout': 'NetworkError',
      'rate limit': 'RateLimitExceeded',
      'unauthorized': 'Unauthorized',
    };

    for (const [pattern, reason] of Object.entries(errorPatterns)) {
      if (message.includes(pattern)) {
        return reason;
      }
    }

    return 'UnknownError';
  }
}
