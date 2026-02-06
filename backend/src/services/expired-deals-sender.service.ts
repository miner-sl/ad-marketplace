import logger from '../utils/logger';
import { DealModel } from '../repositories/deal-model.repository';
import { TelegramNotificationQueueService } from './telegram-notification-queue.service';
import { Deal } from '../models/deal.types';

export interface ExpiredDealDeclineResult {
  success: boolean;
  error?: {
    reason: string;
    message: string;
  };
}

/**
 * Service responsible for declining expired deals
 * Handles the actual decline logic and notifications
 */
export class ExpiredDealsSenderService {
  private readonly logger = logger;

  /**
   * Decline an expired deal
   *
   * Handles the decline process, including:
   * - Declining the deal via DealModel
   * - Sending notifications to both parties
   * - Error handling and classification
   *
   * @param deal - The expired deal to decline
   * @param advertiser - The advertiser user object
   * @param channelOwner - The channel owner user object
   * @returns Result object containing success status or error details
   */
  async declineExpiredDeal(
    deal: Deal,
    advertiser: { telegram_id: number } | undefined,
    channelOwner: { telegram_id: number } | undefined
  ): Promise<ExpiredDealDeclineResult> {
    try {
      this.logger.debug(`Declining expired Deal #${deal.id}`, {
        dealId: deal.id,
      });

      await DealModel.decline(deal.id, 'Deal expired (timeout)');
      const notificationPromises: Promise<void>[] = [];
      if (advertiser) {
        notificationPromises.push(
          TelegramNotificationQueueService.queueTelegramMessage(
            advertiser.telegram_id,
            `⏰ Deal #${deal.id} has expired and been declined.\n\n` +
            `Reason: Timeout (no activity for 10 days)\n\n` +
            `Use /deal ${deal.id} to view details.`
          ).catch((err: any) => {
            this.logger.warn(`Failed to queue notification for advertiser Deal #${deal.id}`, {
              dealId: deal.id,
              error: err.message,
            });
          })
        );
      }

      if (channelOwner) {
        notificationPromises.push(
          TelegramNotificationQueueService.queueTelegramMessage(
            channelOwner.telegram_id,
            `⏰ Deal #${deal.id} has expired and been declined.\n\n` +
            `Reason: Timeout (no activity for 10 days)\n\n` +
            `Use /deal ${deal.id} to view details.`
          ).catch((err: any) => {
            this.logger.warn(`Failed to queue notification for channel owner Deal #${deal.id}`, {
              dealId: deal.id,
              error: err.message,
            });
          })
        );
      }

      await Promise.allSettled(notificationPromises);

      this.logger.info(`Successfully declined expired Deal #${deal.id}`, {
        dealId: deal.id,
      });

      return {
        success: true,
      };
    } catch (error: any) {
      this.logger.error(`Error declining expired Deal #${deal.id}`, {
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
   * @private
   */
  private classifyError(error: unknown): string {
    if (!(error instanceof Error)) {
      return 'UnknownError';
    }

    const message = error.message.toLowerCase();

    const errorPatterns: Record<string, string> = {
      'deal not found': 'DealNotFound',
      'status changed': 'StatusChanged',
      'unauthorized': 'Unauthorized',
      'timeout': 'TimeoutError',
      'network': 'NetworkError',
    };

    for (const [pattern, reason] of Object.entries(errorPatterns)) {
      if (message.includes(pattern)) {
        return reason;
      }
    }

    return 'UnknownError';
  }
}
