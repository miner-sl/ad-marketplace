import * as cron from 'node-cron';
import logger from '../utils/logger';
import db from '../db/connection';
import { UserModel } from '../repositories/user.repository';
import { TonEscrowPaymentPollingSenderService } from './ton-escrow-payment-polling-sender.service';
import { isPrimaryWorker } from '../utils/cluster.util';

/**
 * Service responsible for polling TON escrow payments
 * Runs on a cron schedule to batch process deals with pending payments
 */
export class TonEscrowPaymentPollingService {
  private readonly logger = logger;
  private isProcessing = false;
  private readonly batchSize = 100;
  private job: cron.ScheduledTask | null = null;

  /**
   * Initialize the scheduler service
   */
  onModuleInit(): void {
    this.logger.info('TonEscrowPaymentPollingService initialized');
  }

  /**
   * Start the payment polling job
   * Runs every 2 minutes to check for deals with pending payments
   */
  start(): void {
    if (!isPrimaryWorker()) {
      this.logger.info('TonEscrowPaymentPollingService: Skipping start (not primary worker)');
      return;
    }

    if (this.job) {
      this.logger.warn('TonEscrowPaymentPollingService: Job already started');
      return;
    }

    // Run every 2 minutes
    this.job = cron.schedule('*/2 * * * *', async () => {
      await this.processPaymentChecks();
    });

    this.logger.info('TonEscrowPaymentPollingService: Payment polling job started (runs every 2 minutes)');
  }

  /**
   * Stop the payment polling job
   */
  stop(): void {
    if (this.job) {
      this.job.stop();
      this.job = null;
      this.logger.info('TonEscrowPaymentPollingService: Payment polling job stopped');
    }
  }

  /**
   * Process deals with pending payments
   * Uses a flag to prevent concurrent processing
   */
  private async processPaymentChecks(): Promise<void> {
    if (this.isProcessing) {
      this.logger.debug('TonEscrowPaymentPollingService: Already processing, skipping');
      return;
    }

    this.isProcessing = true;

    try {
      const dealsResult = await db.query(
        `SELECT * FROM deals 
         WHERE status = 'payment_pending' 
         AND escrow_address IS NOT NULL
         AND payment_tx_hash IS NULL
         ORDER BY created_at ASC
         LIMIT $1`,
        [this.batchSize]
      );

      const deals = dealsResult?.rows || [];

      if (deals.length === 0) {
        return;
      }

      this.logger.info(`Processing ${deals.length} deals with pending payments`);

      // Batch fetch users to avoid N+1 queries
      const userIds = new Set<number>();
      deals.forEach((deal: any) => {
        userIds.add(deal.advertiser_id);
        userIds.add(deal.channel_owner_id);
      });
      const usersMap = await UserModel.findByIds(Array.from(userIds));

      const paymentCheckSenderService = new TonEscrowPaymentPollingSenderService();

      for (const deal of deals) {
        try {
          const advertiser = usersMap.get(deal.advertiser_id);
          const channelOwner = usersMap.get(deal.channel_owner_id);

          if (!advertiser || !channelOwner) {
            this.logger.warn(`Deal #${deal.id}: Missing user data`, {
              dealId: deal.id,
              advertiserId: deal.advertiser_id,
              channelOwnerId: deal.channel_owner_id,
            });
            continue;
          }

          const result = await paymentCheckSenderService.checkAndConfirmPayment(deal);

          if (result.success && result.confirmed) {
            this.logger.info(`Successfully confirmed payment for Deal #${deal.id}`, {
              dealId: deal.id,
              txHash: result.txHash,
            });
          } else {
            // Log but don't treat as error if it's a concurrent processing or already confirmed case
            if (
              result.error?.reason === 'ConcurrentProcessing' ||
              result.error?.reason === 'AlreadyConfirmed' ||
              result.error?.reason === 'PaymentNotReceived'
            ) {
              this.logger.debug(`Deal #${deal.id} payment check skipped`, {
                dealId: deal.id,
                reason: result.error.reason,
              });
            } else {
              this.logger.error(`Failed to check payment for Deal #${deal.id}`, {
                dealId: deal.id,
                error: result.error,
              });
            }
          }
        } catch (error: any) {
          this.logger.error(`Error processing payment check for Deal #${deal.id}`, {
            dealId: deal.id,
            error: error.message,
            stack: error.stack,
          });
          // Continue processing other deals even if one fails
        }
      }

      this.logger.info(`Processed ${deals.length} payment checks`);
    } catch (error: any) {
      this.logger.error('Error processing payment checks', {
        error: error.message,
        stack: error.stack,
      });
    } finally {
      this.isProcessing = false;
    }
  }
}
