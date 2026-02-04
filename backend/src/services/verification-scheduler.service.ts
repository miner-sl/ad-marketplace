import * as cron from 'node-cron';
import logger from '../utils/logger';
import { DealRepository } from '../repositories/deal.repository';
import { UserModel } from '../repositories/user.repository';
import { VerificationSenderService } from './verification-sender.service';
import { isPrimaryWorker } from '../utils/cluster.util';

/**
 * Service responsible for scheduling and processing deal verifications
 * Runs on a cron schedule to batch process deals ready for verification
 */
export class VerificationSchedulerService {
  private readonly logger = logger;
  private isProcessing = false;
  private readonly batchSize = 100;
  private job: cron.ScheduledTask | null = null;

  /**
   * Initialize the scheduler service
   */
  onModuleInit(): void {
    this.logger.info('VerificationSchedulerService initialized');
  }

  /**
   * Start the verification processing job
   * Runs every hour to check for deals ready for verification
   */
  start(): void {
    if (!isPrimaryWorker()) {
      this.logger.info('VerificationSchedulerService: Skipping start (not primary worker)');
      return;
    }

    if (this.job) {
      this.logger.warn('VerificationSchedulerService: Job already started');
      return;
    }

    // Run every hour
    this.job = cron.schedule('0 * * * *', async () => {
      await this.processVerifications();
    });

    this.logger.info('VerificationSchedulerService: Verification job started (runs every hour)');
  }

  /**
   * Stop the verification processing job
   */
  stop(): void {
    if (this.job) {
      this.job.stop();
      this.job = null;
      this.logger.info('VerificationSchedulerService: Verification job stopped');
    }
  }

  /**
   * Process deals that are ready for verification
   * Uses a flag to prevent concurrent processing
   */
  private async processVerifications(): Promise<void> {
    if (this.isProcessing) {
      this.logger.debug('VerificationSchedulerService: Already processing, skipping');
      return;
    }

    this.isProcessing = true;

    try {
      const deals = await DealRepository.findDealsReadyForVerificationWithChannels(this.batchSize);

      if (deals.length === 0) {
        return;
      }

      this.logger.info(`Processing ${deals.length} deals for verification`);

      // Batch fetch users to avoid N+1 queries
      const userIds = new Set<number>();
      deals.forEach((deal: any) => {
        userIds.add(deal.advertiser_id);
        userIds.add(deal.channel_owner_id);
      });
      const usersMap = await UserModel.findByIds(Array.from(userIds));

      const verificationSenderService = new VerificationSenderService();

      for (const deal of deals) {
        try {
          // Check if deal still requires verification (might have been processed by another instance)
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

          const result = await verificationSenderService.verifyDeal(deal);

          if (result.success) {
            if (result.verified) {
              this.logger.info(`Successfully verified Deal #${deal.id}`, {
                dealId: deal.id,
              });
            } else if (result.refunded) {
              this.logger.info(`Deal #${deal.id} marked for refund (post not found)`, {
                dealId: deal.id,
              });
            }
          } else {
            // Log but don't treat as error if it's a duration requirement or verification period issue
            if (
              result.error?.reason === 'DurationRequirementNotMet' ||
              result.error?.reason === 'VerificationPeriodNotComplete'
            ) {
              this.logger.debug(`Deal #${deal.id} verification skipped`, {
                dealId: deal.id,
                reason: result.error.reason,
              });
            } else {
              this.logger.error(`Failed to verify Deal #${deal.id}`, {
                dealId: deal.id,
                error: result.error,
              });
            }
          }
        } catch (error: any) {
          this.logger.error(`Error processing verification for Deal #${deal.id}`, {
            dealId: deal.id,
            error: error.message,
            stack: error.stack,
          });
          // Continue processing other deals even if one fails
        }
      }

      this.logger.info(`Processed ${deals.length} verification deals`);
    } catch (error: any) {
      this.logger.error('Error processing verifications', {
        error: error.message,
        stack: error.stack,
      });
    } finally {
      this.isProcessing = false;
    }
  }
}
