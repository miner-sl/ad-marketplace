import logger from '../utils/logger';
import { TONService } from './ton.service';
import { TelegramNotificationService } from './telegram-notification.service';
import { Deal } from '../models/deal.types';
import { withTx } from '../utils/transaction';
import { distributedLock } from '../utils/lock';

export interface AutoReleaseResult {
  success: boolean;
  txHash?: string;
  error?: {
    reason: string;
    message: string;
  };
}

/**
 * Service responsible for auto-releasing funds for verified deals
 * Handles the actual fund release logic and error classification
 */
export class AutoReleaseSenderService {
  /**
   * Auto-release funds for a verified deal where buyer didn't confirm
   *
   * Handles the fund release process, including:
   * - Acquiring distributed lock to prevent concurrent releases
   * - Verifying deal status and idempotency
   * - Releasing funds via TONService
   * - Updating deal status atomically
   * - Sending notifications
   * - Error handling and classification
   *
   * @param deal - The deal entity to release funds for
   * @returns Result object containing success status, txHash, or error details
   */
  async releaseFundsFromEscrowToChannelOwner(deal: Deal): Promise<AutoReleaseResult> {
    try {
      logger.debug(`Auto-releasing funds for Deal #${deal.id}`, {
        dealId: deal.id,
        status: deal.status,
      });

      if (!deal.escrow_address || !deal.channel_owner_wallet_address) {
        return {
          success: false,
          error: {
            reason: 'MissingAddresses',
            message: `Deal #${deal.id}: Missing escrow or wallet address`,
          },
        };
      }

      let txHash: string | null = null;

      try {
        await distributedLock.withLock(
          deal.id,
          'auto_release',
          async () => {
            await withTx(async (client) => {
              const dealCheck = await client.query(
                `SELECT * FROM deals WHERE id = $1 FOR UPDATE`,
                [deal.id]
              );

              if (dealCheck.rows.length === 0) {
                logger.debug(`Deal #${deal.id} not found`, { dealId: deal.id });
                return;
              }

              const currentDeal = dealCheck.rows[0];

              if (currentDeal.status === 'completed' && currentDeal.payment_tx_hash) {
                logger.debug(`Deal #${deal.id} already has funds released`, {
                  dealId: deal.id,
                  existingTxHash: currentDeal.payment_tx_hash,
                });
                txHash = currentDeal.payment_tx_hash;
                return;
              }

              if (currentDeal.status !== 'verified') {
                logger.debug(`Deal #${deal.id} not in verified status`, {
                  dealId: deal.id,
                  status: currentDeal.status,
                });
                return;
              }

              // Release funds BEFORE updating status
              // This ensures if release fails, status stays verified
              if (!currentDeal.channel_owner_wallet_address) {
                logger.warn(`Deal #${deal.id}: Missing channel owner wallet address`, { dealId: deal.id });
                return;
              }

              txHash = await TONService.releaseFunds(
                deal.id,
                currentDeal.channel_owner_wallet_address as string,
                currentDeal.price_ton.toString(),
                `Auto-release: Buyer did not confirm within timeout period (Deal #${deal.id})`,
                false // Already checked idempotency above
              );

              // Update status and record tx hash atomically
              const updateResult = await client.query(
                `UPDATE deals 
                 SET status = 'completed', payment_tx_hash = $1, updated_at = CURRENT_TIMESTAMP
                 WHERE id = $2 AND status = 'verified' AND status != 'completed'
                 RETURNING *`,
                [txHash, deal.id]
              );

              if (updateResult.rows.length === 0) {
                // Another process released funds between our check and update
                // Re-query to get the existing tx hash
                const recheck = await client.query(
                  `SELECT payment_tx_hash, status FROM deals WHERE id = $1`,
                  [deal.id]
                );
                if (recheck.rows.length > 0 && recheck.rows[0].status === 'completed' && recheck.rows[0].payment_tx_hash) {
                  txHash = recheck.rows[0].payment_tx_hash;
                  logger.warn(`Funds were released by another process for Deal #${deal.id}`, {
                    dealId: deal.id,
                    existingTxHash: txHash,
                  });
                } else {
                  throw new Error(`Failed to update deal status for Deal #${deal.id}`);
                }
              }
            });
          },
          { ttl: 60000 } // 60 seconds in milliseconds (fund release takes longer)
        );
      } catch (lockError: any) {
        // If lock acquisition failed, another instance is processing this deal
        if (lockError.message?.includes('Failed to acquire distributed lock')) {
          logger.debug(`Deal #${deal.id} auto-release skipped (locked by another instance)`, {
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
        throw lockError;
      }

      if (!txHash) {
        return {
          success: false,
          error: {
            reason: 'NoReleaseNeeded',
            message: `Deal #${deal.id} does not require fund release (status changed or already released)`,
          },
        };
      }

      try {
        // Notify both parties about deal auto-completion (buyer didn't confirm)
        await TelegramNotificationService.notifyDealAutoCompleted(
          deal.id,
          deal.advertiser_id,
          deal.channel_owner_id,
          {
            dealId: deal.id,
            priceTon: deal.price_ton,
            channelOwnerWalletAddress: deal.channel_owner_wallet_address,
            txHash: txHash,
          }
        );
      } catch (notifError: any) {
        logger.warn(`Failed to send notification for Deal #${deal.id}`, {
          dealId: deal.id,
          error: notifError.message,
        });
        // Don't fail the whole operation if notification fails
      }

      logger.info(`Successfully auto-released funds for Deal #${deal.id}`, {
        dealId: deal.id,
        txHash,
        reason: 'Buyer did not confirm within timeout period',
      });

      return {
        success: true,
        txHash,
      };
    } catch (error: any) {
      logger.error(`Error auto-releasing funds for Deal #${deal.id}`, {
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
      'missing escrow': 'MissingAddresses',
      'missing wallet': 'MissingAddresses',
      'failed to acquire distributed lock': 'ConcurrentProcessing',
      'not in verified status': 'InvalidStatus',
      'already has funds released': 'AlreadyReleased',
      'failed to release funds': 'ReleaseFailed',
      'network': 'NetworkError',
      'timeout': 'NetworkError',
      'insufficient funds': 'InsufficientFunds',
    };

    for (const [pattern, reason] of Object.entries(errorPatterns)) {
      if (message.includes(pattern)) {
        return reason;
      }
    }

    return 'UnknownError';
  }

  /**
   * Refund funds for a declined deal back to advertiser
   *
   * Handles the refund process, including:
   * - Acquiring distributed lock to prevent concurrent refunds
   * - Verifying deal status and idempotency
   * - Refunding funds via TONService
   * - Validating transaction exists
   * - Updating deal status to refunded atomically
   * - Sending notifications
   * - Error handling and classification
   *
   * @param deal - The deal entity to refund funds for
   * @param advertiserWalletAddress - Advertiser's wallet address to refund to
   * @returns Result object containing success status, txHash, or error details
   */
  async refundFundsFromEscrowToAdvertiser(
    deal: Deal,
    advertiserWalletAddress: string
  ): Promise<AutoReleaseResult> {
    try {
      logger.debug(`Refunding funds for Deal #${deal.id}`, {
        dealId: deal.id,
        status: deal.status,
        advertiserWalletAddress,
      });

      if (!deal.escrow_address || !advertiserWalletAddress) {
        return {
          success: false,
          error: {
            reason: 'MissingAddresses',
            message: `Deal #${deal.id}: Missing escrow or advertiser wallet address`,
          },
        };
      }

      let txHash: string | null = null;

      try {
        await distributedLock.withLock(
          deal.id,
          'refund',
          async () => {
            await withTx(async (client) => {
              const dealCheck = await client.query(
                `SELECT * FROM deals WHERE id = $1 FOR UPDATE`,
                [deal.id]
              );

              if (dealCheck.rows.length === 0) {
                logger.debug(`Deal #${deal.id} not found`, { dealId: deal.id });
                return;
              }

              const currentDeal = dealCheck.rows[0];

              // Check if already refunded
              if (currentDeal.status === 'refunded' && currentDeal.refund_tx_hash) {
                logger.debug(`Deal #${deal.id} already refunded`, {
                  dealId: deal.id,
                  existingTxHash: currentDeal.refund_tx_hash,
                });
                txHash = currentDeal.refund_tx_hash;
                return;
              }

              if (currentDeal.status !== 'declined') {
                logger.debug(`Deal #${deal.id} not in declined status`, {
                  dealId: deal.id,
                  status: currentDeal.status,
                });
                return;
              }

              // Refund funds BEFORE updating status
              // This ensures if refund fails, status stays declined
              txHash = await TONService.releaseFunds(
                deal.id,
                advertiserWalletAddress,
                currentDeal.price_ton.toString(),
                `Refund: Deal declined (Deal #${deal.id})`,
                false // Already checked idempotency above
              );

              // Validate transaction exists
              if (txHash) {
                try {
                  // Verify transaction exists on blockchain
                  const txExists = await TONService.verifyTransaction(txHash, currentDeal.escrow_address);
                  if (!txExists) {
                    throw new Error(`Transaction ${txHash} not found on blockchain`);
                  }
                } catch (verifyError: any) {
                  logger.error(`Failed to verify transaction ${txHash} for Deal #${deal.id}`, {
                    dealId: deal.id,
                    txHash,
                    error: verifyError.message,
                  });
                  throw new Error(`Transaction verification failed: ${verifyError.message}`);
                }
              }

              // Update status and record refund tx hash atomically
              const updateResult = await client.query(
                `UPDATE deals 
                 SET status = 'refunded', refund_tx_hash = $1, updated_at = CURRENT_TIMESTAMP
                 WHERE id = $2 AND status = 'declined'
                 RETURNING *`,
                [txHash, deal.id]
              );

              if (updateResult.rows.length === 0) {
                // Another process refunded funds between our check and update
                // Re-query to get the existing tx hash
                const recheck = await client.query(
                  `SELECT refund_tx_hash, status FROM deals WHERE id = $1`,
                  [deal.id]
                );
                if (recheck.rows.length > 0 && recheck.rows[0].status === 'refunded' && recheck.rows[0].refund_tx_hash) {
                  txHash = recheck.rows[0].refund_tx_hash;
                  logger.warn(`Funds were refunded by another process for Deal #${deal.id}`, {
                    dealId: deal.id,
                    existingTxHash: txHash,
                  });
                } else {
                  throw new Error(`Failed to update deal status for Deal #${deal.id}`);
                }
              }
            });
          },
          { ttl: 60000 } // 60 seconds in milliseconds (refund takes longer)
        );
      } catch (lockError: any) {
        // If lock acquisition failed, another instance is processing this deal
        if (lockError.message?.includes('Failed to acquire distributed lock')) {
          logger.debug(`Deal #${deal.id} refund skipped (locked by another instance)`, {
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
        throw lockError;
      }

      if (!txHash) {
        return {
          success: false,
          error: {
            reason: 'NoRefundNeeded',
            message: `Deal #${deal.id} does not require refund (status changed or already refunded)`,
          },
        };
      }

      try {
        await TelegramNotificationService.notifyDealRefunded(
          deal.id,
          deal.advertiser_id,
          {
            dealId: deal.id,
            priceTon: deal.price_ton,
            txHash: txHash,
            advertiserWalletAddress: advertiserWalletAddress,
          }
        );
      } catch (notifError: any) {
        logger.warn(`Failed to send notification for Deal #${deal.id}`, {
          dealId: deal.id,
          error: notifError.message,
        });
        // Don't fail the whole operation if notification fails
      }

      logger.info(`Successfully refunded funds for Deal #${deal.id}`, {
        dealId: deal.id,
        txHash,
        reason: 'Deal declined',
      });

      return {
        success: true,
        txHash,
      };
    } catch (error: any) {
      logger.error(`Error refunding funds for Deal #${deal.id}`, {
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
}
