import logger from '../utils/logger';
import { TONService } from './ton.service';
import { DealFlowService } from './deal-flow.service';
import { TelegramNotificationService } from './telegram-notification.service';
import { Deal } from '../models/deal.types';

export interface PaymentCheckResult {
  success: boolean;
  confirmed?: boolean;
  txHash?: string;
  error?: {
    reason: string;
    message: string;
  };
}

/**
 * Service responsible for checking and confirming escrow payments
 * Handles the actual payment checking logic and error classification
 */
export class TonEscrowPaymentPollingSenderService {
  private readonly logger = logger;

  /**
   * Check and confirm payment for a deal
   *
   * Handles the payment confirmation process, including:
   * - Checking payment status via TONService
   * - Confirming payment with distributed lock
   * - Sending notifications
   * - Error handling and classification
   *
   * @param deal - The deal entity to check payment for
   * @returns Result object containing success status, confirmation status, txHash, or error details
   */
  async checkAndConfirmPayment(deal: Deal): Promise<PaymentCheckResult> {
    try {
      this.logger.debug(`Checking payment for Deal #${deal.id}`, {
        dealId: deal.id,
        escrowAddress: deal.escrow_address,
        status: deal.status,
      });

      if (!deal.escrow_address) {
        return {
          success: false,
          error: {
            reason: 'MissingEscrowAddress',
            message: `Deal #${deal.id}: Missing escrow address`,
          },
        };
      }

      if (deal.payment_tx_hash && deal.status !== 'payment_pending') {
        this.logger.debug(`Deal #${deal.id} payment already confirmed, skipping`, {
          dealId: deal.id,
          existingTxHash: deal.payment_tx_hash,
          status: deal.status,
        });
        return {
          success: false,
          error: {
            reason: 'AlreadyConfirmed',
            message: `Deal #${deal.id} payment already confirmed`,
          },
        };
      }

      const paymentCheck = await TONService.checkPayment(
        deal.escrow_address,
        deal.price_ton.toString()
      );

      if (!paymentCheck.received) {
        return {
          success: false,
          error: {
            reason: 'PaymentNotReceived',
            message: `Deal #${deal.id}: Payment not yet received`,
          },
        };
      }

      this.logger.info(`Payment detected for Deal #${deal.id}`, {
        dealId: deal.id,
        amount: paymentCheck.amount,
      });

      const txHash = paymentCheck.txHash || `auto_${Date.now()}`;
      let confirmedDeal;

      try {
        confirmedDeal = await DealFlowService.confirmPayment(deal.id, txHash);
        this.logger.info(`Deal #${deal.id} payment confirmed`, { dealId: deal.id, txHash });
      } catch (error: any) {
        if (error.message?.includes('Failed to acquire distributed lock')) {
          this.logger.debug(`Deal #${deal.id} payment confirmation skipped (locked by another instance)`, {
            dealId: deal.id,
          });
          return {
            success: false,
            error: {
              reason: 'ConcurrentProcessing',
              message: `Deal #${deal.id} is being processed by another instance`,
            },
          };
        }
        if (error.message.includes('already confirmed') || error.message.includes('status changed')) {
          this.logger.debug(`Deal #${deal.id} payment already confirmed`, { dealId: deal.id });
          return {
            success: false,
            error: {
              reason: 'AlreadyConfirmed',
              message: `Deal #${deal.id} payment already confirmed`,
            },
          };
        }
        throw error;
      }

      if (confirmedDeal && confirmedDeal.payment_tx_hash === txHash) {
        try {
          await TelegramNotificationService.notifyPaymentConfirmed(
            deal.id,
            deal.advertiser_id,
            deal.channel_owner_id,
            deal.price_ton
          );
        } catch (notifError: any) {
          this.logger.warn(`Failed to send notification for Deal #${deal.id}`, {
            dealId: deal.id,
            error: notifError.message,
          });
        }

        return {
          success: true,
          confirmed: true,
          txHash,
        };
      } else {
        this.logger.debug(`Deal #${deal.id} payment was confirmed by another process, skipping notifications`, {
          dealId: deal.id,
          returnedTxHash: confirmedDeal?.payment_tx_hash,
          attemptedTxHash: txHash,
        });
        return {
          success: false,
          error: {
            reason: 'AlreadyConfirmed',
            message: `Deal #${deal.id} payment was confirmed by another process`,
          },
        };
      }
    } catch (error: any) {
      this.logger.error(`Error checking payment for Deal #${deal.id}`, {
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
      'missing escrow': 'MissingEscrowAddress',
      'payment not received': 'PaymentNotReceived',
      'failed to acquire distributed lock': 'ConcurrentProcessing',
      'already confirmed': 'AlreadyConfirmed',
      'status changed': 'InvalidStatus',
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
