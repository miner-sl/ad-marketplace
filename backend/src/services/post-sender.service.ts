import logger from '../utils/logger';
import {PostService, PublishedPost} from './post.service';
import { TelegramNotificationService } from './telegram-notification.service';
import {DealScheduledDTO} from "../repositories/deal.repository";

export interface PublishPostResult {
  success: boolean;
  messageId?: number;
  postLink?: string;
  error?: {
    reason: string;
    message: string;
  };
}

/**
 * Service responsible for sending/publishing posts
 * Handles the actual publishing logic and error classification
 */
export class PostSenderService {
  private readonly logger = logger;

  /**
   * Publish a scheduled post for a deal
   *
   * Handles the publishing process, including:
   * - Building post content from deal brief
   * - Publishing via PostService
   * - Sending notifications
   * - Error handling and classification
   *
   * @param deal - The deal entity to publish
   * @returns Result object containing success status, messageId/postLink, or error details
   */
  async publishPost(deal: DealScheduledDTO): Promise<PublishPostResult> {
    try {
      this.logger.debug(`Publishing post for Deal #${deal.id}`, {
        dealId: deal.id,
        channelId: deal.channel_id,
        scheduledTime: deal.scheduled_post_time,
      });

      const postText = await PostService.getPostTextFromDeal(deal.id);

      if (!postText) {
        return {
          success: false,
          error: {
            reason: 'NoBriefFound',
            message: `No brief found for Deal #${deal.id}`,
          },
        };
      }

      const result: PublishedPost = await PostService.preparePublishPost(deal.id, deal.channel_id, postText);

      try {
        await TelegramNotificationService.notifyPostPublished(deal.id, deal.advertiser_id, result.postLink);
      } catch (notifError: any) {
        this.logger.warn(`Failed to send notification for Deal #${deal.id}`, {
          dealId: deal.id,
          error: notifError.message,
        });
        // Don't fail the whole operation if notification fails
      }

      this.logger.info(`Successfully published post for Deal #${deal.id}`, {
        dealId: deal.id,
        messageId: result.messageId,
        postLink: result.postLink,
      });

      return {
        success: true,
        messageId: result.messageId,
        postLink: result.postLink,
      };
    } catch (error: any) {
      this.logger.error(`Error publishing post for Deal #${deal.id}`, {
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
   * Classify error into specific category
   *
   * Analyzes error message to determine error type for better handling
   * and retry logic.
   *
   * @param error - The error to classify
   * @returns Categorized error reason string
   * @private
   */
  private classifyError(error: unknown): string {
    if (!(error instanceof Error)) {
      return 'UnknownError';
    }

    const message = error.message.toLowerCase();

    const errorPatterns: Record<string, string> = {
      'deal not found': 'DealNotFound',
      'channel not found': 'ChannelNotFound',
      'no brief found': 'NoBriefFound',
      'cannot publish post in status': 'InvalidStatus',
      'post already published': 'AlreadyPublished',
      'failed to acquire distributed lock': 'ConcurrentProcessing',
      'bot was blocked': 'BotBlocked',
      'chat not found': 'ChatNotFound',
      'not enough rights': 'ChatRestricted',
      'rate limit': 'RateLimitExceeded',
      'network': 'NetworkError',
      'timeout': 'NetworkError',
    };

    for (const [pattern, reason] of Object.entries(errorPatterns)) {
      if (message.includes(pattern)) {
        return reason;
      }
    }

    return 'UnknownError';
  }
}
