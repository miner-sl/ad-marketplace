import logger from '../utils/logger';
import { DealModel } from '../repositories/deal-model.repository';
import { TelegramService } from './telegram.service';
import { TelegramNotificationService } from './telegram-notification.service';

export interface VerificationResult {
  success: boolean;
  verified?: boolean;
  refunded?: boolean;
  error?: {
    reason: string;
    message: string;
  };
}

/**
 * Service responsible for verifying posted deals
 * Handles the actual verification logic and error classification
 */
export class VerificationSenderService {
  private readonly logger = logger;

  /**
   * Verify a posted deal
   *
   * Handles the verification process, including:
   * - Checking if verification period has passed
   * - Verifying bot has access to channel
   * - Checking if post exists and meets duration requirements
   * - Marking deal as verified or refunded
   * - Sending notifications
   * - Error handling and classification
   *
   * @param deal - The deal entity to verify (with telegram_channel_id from join)
   * @returns Result object containing success status, verification/refund status, or error details
   */
  async verifyDeal(deal: any): Promise<VerificationResult> {
    try {
      this.logger.debug(`Verifying Deal #${deal.id}`, {
        dealId: deal.id,
        channelId: deal.channel_id,
        telegramChannelId: deal.telegram_channel_id,
      });

      // Validate required fields
      if (!deal.post_message_id || !deal.channel_id) {
        return {
          success: false,
          error: {
            reason: 'MissingPostData',
            message: `Deal #${deal.id}: Missing post_message_id or channel_id`,
          },
        };
      }

      if (!deal.telegram_channel_id) {
        return {
          success: false,
          error: {
            reason: 'MissingChannelData',
            message: `Deal #${deal.id}: Channel telegram_channel_id not found`,
          },
        };
      }

      if (!deal.post_verification_until) {
        return {
          success: false,
          error: {
            reason: 'MissingVerificationUntil',
            message: `Deal #${deal.id}: Missing post_verification_until`,
          },
        };
      }

      const verificationUntil = new Date(deal.post_verification_until);
      const now = new Date();

      // Check if verification period has passed
      if (verificationUntil > now) {
        const remainingMs = verificationUntil.getTime() - now.getTime();
        const remainingHours = Math.ceil(remainingMs / (1000 * 60 * 60));
        this.logger.debug(`Deal #${deal.id}: Verification period not yet complete`, {
          dealId: deal.id,
          remainingHours,
        });
        return {
          success: false,
          error: {
            reason: 'VerificationPeriodNotComplete',
            message: `Deal #${deal.id}: Verification period not yet complete (${remainingHours} hours remaining)`,
          },
        };
      }

      // Verify post exists and bot has access
      const postExists = await this.checkPostExists(deal);

      if (!postExists) {
        // Post not found - refund
        await DealModel.updateStatus(deal.id, 'refunded');
        this.logger.warn(`Deal #${deal.id}: Post not found, marked for refund`, { dealId: deal.id });

        // Send notifications
        try {
          await TelegramNotificationService.notifyVerificationFailed(deal.id, deal.advertiser_id, deal.channel_owner_id);
        } catch (notifError: any) {
          this.logger.warn(`Failed to send notification for Deal #${deal.id}`, {
            dealId: deal.id,
            error: notifError.message,
          });
        }

        return {
          success: true,
          refunded: true,
        };
      }

      // Post exists - check if duration requirement is met
      const minPublicationDurationDays = deal.min_publication_duration_days || 7;
      let publicationDurationMet = false;
      let daysSinceFirstPublication = 0;

      if (deal.first_publication_time) {
        const firstPublicationTime = new Date(deal.first_publication_time);
        daysSinceFirstPublication = (now.getTime() - firstPublicationTime.getTime()) / (1000 * 60 * 60 * 24);
        publicationDurationMet = daysSinceFirstPublication >= minPublicationDurationDays;
      }

      if (!publicationDurationMet) {
        // Duration requirement not met - notify channel owner but don't verify yet
        this.logger.info(`Deal #${deal.id}: Post verified but duration requirement not met`, {
          dealId: deal.id,
          daysSinceFirstPublication: Math.floor(daysSinceFirstPublication),
          minPublicationDurationDays,
        });

        try {
          await TelegramNotificationService.notifyDurationNotMet(
            deal.id,
            deal.channel_owner_id,
            Math.floor(daysSinceFirstPublication),
            minPublicationDurationDays
          );
        } catch (notifError: any) {
          this.logger.warn(`Failed to send notification for Deal #${deal.id}`, {
            dealId: deal.id,
            error: notifError.message,
          });
        }

        return {
          success: false,
          error: {
            reason: 'DurationRequirementNotMet',
            message: `Deal #${deal.id}: Minimum publication duration not reached`,
          },
        };
      }

      // Post verified and duration requirement met - mark as verified
      await DealModel.markVerified(deal.id);

      this.logger.info(`Deal #${deal.id} marked as verified - waiting for advertiser confirmation`, {
        dealId: deal.id,
        daysSinceFirstPublication: Math.floor(daysSinceFirstPublication),
        minPublicationDurationDays,
      });

      // Send notifications
      try {
        await TelegramNotificationService.notifyDealVerified(
          deal.id,
          deal.advertiser_id,
          deal.channel_owner_id,
          Math.floor(daysSinceFirstPublication),
          minPublicationDurationDays
        );
      } catch (notifError: any) {
        this.logger.warn(`Failed to send notification for Deal #${deal.id}`, {
          dealId: deal.id,
          error: notifError.message,
        });
      }

      return {
        success: true,
        verified: true,
      };
    } catch (error: any) {
      this.logger.error(`Error verifying Deal #${deal.id}`, {
        dealId: deal.id,
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
   * Check if post exists and bot has access to channel
   * @private
   */
  private async checkPostExists(deal: any): Promise<boolean> {
    try {
      const channelId = deal.telegram_channel_id;
      const now = new Date();

      // Check if bot still has access to channel
      const botInfo = await TelegramService.bot.getMe();
      const member = await TelegramService.bot.getChatMember(channelId, botInfo.id);

      if (member.status !== 'administrator' && member.status !== 'creator') {
        this.logger.warn(`Deal #${deal.id}: Bot is not admin of channel`, {
          dealId: deal.id,
          channelId,
          botStatus: member.status,
        });
        return false;
      }

      // Bot has access - check if post meets minimum publication duration
      const minPublicationDurationDays = deal.min_publication_duration_days || 7;
      if (deal.actual_post_time) {
        const postTime = new Date(deal.actual_post_time);
        const daysSincePost = (now.getTime() - postTime.getTime()) / (1000 * 60 * 60 * 24);

        if (daysSincePost >= minPublicationDurationDays) {
          this.logger.info(`Deal #${deal.id}: Post verified (${minPublicationDurationDays} days+ since publication)`, {
            dealId: deal.id,
            daysSincePost: Math.floor(daysSincePost),
            minPublicationDurationDays,
          });
          return true;
        } else {
          this.logger.debug(`Deal #${deal.id}: Post not old enough yet`, {
            dealId: deal.id,
            daysSincePost: Math.floor(daysSincePost),
            minPublicationDurationDays,
          });
          return false;
        }
      } else {
        // No actual_post_time recorded, but verification period passed
        // Assume post exists if bot has access
        this.logger.info(`Deal #${deal.id}: Post verified (verification period passed, bot has access)`, {
          dealId: deal.id,
          minPublicationDurationDays,
        });
        return true;
      }
    } catch (error: any) {
      this.logger.warn(`Deal #${deal.id}: Cannot verify post existence`, {
        dealId: deal.id,
        error: error.message,
      });
      return false;
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
      'deal not found': 'DealNotFound',
      'not in posted status': 'InvalidStatus',
      'bot is not admin': 'BotNotAdmin',
      'chat not found': 'ChatNotFound',
      'network': 'NetworkError',
      'timeout': 'NetworkError',
      'rate limit': 'RateLimitExceeded',
    };

    for (const [pattern, reason] of Object.entries(errorPatterns)) {
      if (message.includes(pattern)) {
        return reason;
      }
    }

    return 'UnknownError';
  }
}
