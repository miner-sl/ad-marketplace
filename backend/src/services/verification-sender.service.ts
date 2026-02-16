import logger from '../utils/logger';
import {DealModel} from '../repositories/deal-model.repository';
import {TelegramService} from './telegram.service';
import {TelegramNotificationService} from './telegram-notification.service';
import {DealRepository} from '../repositories/deal.repository';
import {levenshteinDistance} from '../utils/strings/levenshtein-distance';
import {compareDate} from '../utils/dateCompare';
import env from "../utils/env";

export interface VerificationResult {
  success: boolean;
  verified?: boolean;
  refunded?: boolean;
  error?: {
    reason: string;
    message: string;
  };
}

type PostPublicationTimeDTO ={ ok: boolean, data: { actualDays: number, requiredDays: number } };

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

      const dateCompare = compareDate(deal.post_verification_until);
      if (!dateCompare.hasPassed) {
        this.logger.debug(`Deal #${deal.id}: Verification period not yet complete`, {
          dealId: deal.id,
          remainingHours: dateCompare.remainingHours,
        });
        return {
          success: false,
          error: {
            reason: 'VerificationPeriodNotComplete',
            message: `Deal #${deal.id}: Verification period not yet complete (${dateCompare.remainingHours} hours remaining)`,
          },
        };
      }

      const postExistsAndBotAccess = await this.checkPostExistsAndBotAccess(deal);
      const resultVerificationDuration: PostPublicationTimeDTO = this.verifyPublicationTime(deal);

      const daysSinceFirstPublication = resultVerificationDuration.data.actualDays;
      const minPublicationDurationDays = resultVerificationDuration.data.requiredDays;
      if (!postExistsAndBotAccess) {
        await DealModel.updateStatus(deal.id, 'refunded');
        this.logger.warn(`Deal #${deal.id}: Post not found, marked for refund`, {dealId: deal.id});

        try {
          await TelegramNotificationService.notifyVerificationFailed(deal.id, deal.advertiser_id, deal.channel_owner_id);
        } catch (notifError: any) {
          this.logger.warn(`Failed to send notification for Deal #${deal.id}`, {
            dealId: deal.id,
            error: notifError.message,
          });
        }
        return {
          success: false,
        };
      }

      if (!resultVerificationDuration.ok) {
        return {
          success: false,
          error: {
            reason: 'DurationRequirementNotMet',
            message: `Deal #${deal.id}: Minimum publication duration not reached`,
          },
        };
      }

      await DealModel.markVerified(deal.id);

      this.logger.info(`Deal #${deal.id} marked as verified - waiting for advertiser confirmation`, {
        dealId: deal.id,
        daysSinceFirstPublication: Math.floor(daysSinceFirstPublication),
        minPublicationDurationDays,
      });

      try {
        await TelegramNotificationService.notifyDealVerified(
          deal,
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
   * Also verifies post content matches the requested deal text
   * @private
   */
  private async checkPostExistsAndBotAccess(deal: any): Promise<boolean> {
    try {
      const channelId = deal.telegram_channel_id;

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

      if (deal.post_message_id) {
        const contentMatches = await this.verifyPostContent(deal);
        if (!contentMatches) {
          this.logger.warn(`Deal #${deal.id}: Post content does not match requested text`, {
            dealId: deal.id,
          });
          return false;
        }
      }
      return true;
    } catch (error: any) {
      this.logger.warn(`Deal #${deal.id}: Cannot verify post existence`, {
        dealId: deal.id,
        error: error.message,
      });
      return false;
    }
  }

  private verifyPublicationTime(deal: any, now: Date = new Date()): PostPublicationTimeDTO {
    const minPublicationDurationDays = deal.min_publication_duration_days || env.VERIFIED_TIMEOUT_DAYS | 7;
    if (deal.actual_post_time) {
      const postTime = new Date(deal.actual_post_time);
      const daysSincePost = (now.getTime() - postTime.getTime()) / (1000 * 60 * 60 * 24);

      if (daysSincePost >= minPublicationDurationDays) {
        this.logger.info(`Deal #${deal.id}: Post verified (${minPublicationDurationDays} days+ since publication)`, {
          dealId: deal.id,
          daysSincePost: Math.floor(daysSincePost),
          minPublicationDurationDays,
        });
        return {
          ok: true,
          data: {
            actualDays: Math.floor(daysSincePost),
            requiredDays: minPublicationDurationDays
          }
        };
      } else {
        this.logger.debug(`Deal #${deal.id}: Post not old enough yet`, {
          dealId: deal.id,
          daysSincePost: Math.floor(daysSincePost),
          minPublicationDurationDays,
        });
        return {
          ok: false,
          data: {
            actualDays: Math.floor(daysSincePost),
            requiredDays: minPublicationDurationDays
          }
        };
      }
    } else {
      this.logger.info(`Deal #${deal.id}: Post verified (verification period passed, bot has access)`, {
        dealId: deal.id,
        minPublicationDurationDays,
      });
      return {
        ok: true,
        data: {
          actualDays: Math.floor(deal.first_publication_time),
          requiredDays: minPublicationDurationDays
        }
      };
    }
  }

  private normalizeText(text: string): string {
    return text.trim().replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  };

  /**
   * Verify post content matches the requested deal text
   * Compares stored post_text with requested text from deal_messages
   * @private
   */
  private async verifyPostContent(deal: any): Promise<boolean> {
    try {
      if (!deal.post_message_id || !deal.telegram_channel_id) {
        this.logger.warn(`Deal #${deal.id}: Missing post_message_id or telegram_channel_id for content verification`, {
          dealId: deal.id,
        });
        return true;
      }

      const postTextOnTelegram = await TelegramService.getMessageText(deal.username, deal.post_message_id);
      if (!postTextOnTelegram) {
        this.logger.warn(`Deal #${deal.id}: No post text found on Telegram`, {
          dealId: deal.id,
        });
        return true;
      }

      const storedPostText = await DealRepository.getBrief(deal.id);
      if (!storedPostText) {
        this.logger.warn(`Deal #${deal.id}: No stored post text found (post may have been published before this feature)`, {
          dealId: deal.id,
        });
        const verificationResult = await TelegramService.verifyPost(
          deal.telegram_channel_id,
          deal.post_message_id
        );
        return verificationResult.exists;
      }

      const normalizedRequested = this.normalizeText(postTextOnTelegram);
      const normalizedStored = this.normalizeText(storedPostText);
      const differencePercent = this.calculateTextSimilarity(normalizedRequested, normalizedStored);
      const thresholdPercent = 10; // 10% difference threshold
      const similarity = 100 - differencePercent;

      if (differencePercent > thresholdPercent) {
        this.logger.warn(`Deal #${deal.id}: Post content difference exceeds threshold`, {
          dealId: deal.id,
          similarity: similarity.toFixed(2) + '%',
          differencePercent: differencePercent.toFixed(2) + '%',
          thresholdPercent: thresholdPercent + '%',
          requestedPreview: normalizedRequested.substring(0, 100),
          storedPreview: normalizedStored.substring(0, 100),
        });
        // TODO: send notification to advertiser, and channel owner
        return false;
      }

      this.logger.debug(`Deal #${deal.id}: Post content similarity check passed`, {
        dealId: deal.id,
        similarity: similarity.toFixed(2) + '%',
        differencePercent: differencePercent.toFixed(2) + '%',
      });

      // const verificationResult = await TelegramService.verifyPost(
      //   deal.telegram_channel_id,
      //   deal.post_message_id
      // );
      //
      // if (!verificationResult.exists) {
      //   this.logger.warn(`Deal #${deal.id}: Post message not found in channel`, {
      //     dealId: deal.id,
      //     messageId: deal.post_message_id,
      //   });
      //   return false;
      // }

      this.logger.info(`Deal #${deal.id}: Post content verified (matches requested text and exists in channel)`, {
        dealId: deal.id,
      });
      return true;
    } catch (error: any) {
      this.logger.warn(`Deal #${deal.id}: Error verifying post content`, {
        dealId: deal.id,
        error: error.message,
      });
      return true;
    }
  }

  /**
   * Calculate text difference percentage between two strings
   * Uses Levenshtein distance algorithm to calculate difference percentage
   * @private
   */
  private calculateTextSimilarity(text1: string, text2: string): number {
    if (text1 === text2) {
      return 0.0; // 0% difference
    }

    if (text1.length === 0 || text2.length === 0) {
      return 100.0; // 100% difference
    }

    const dist = levenshteinDistance(text1, text2);
    const maxLength = Math.max(text1.length, text2.length);
    const similarity = 1 - (dist / maxLength);
    const differencePercent = (1 - similarity) * 100;

    return differencePercent;
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
