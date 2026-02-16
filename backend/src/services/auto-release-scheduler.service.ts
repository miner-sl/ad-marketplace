import * as cron from 'node-cron';
import logger from '../utils/logger';
import { DealModel } from '../repositories/deal-model.repository';
import { UserModel } from '../repositories/user.repository';
import { AutoReleaseSenderService } from './auto-release-sender.service';
import { isPrimaryWorker } from '../utils/cluster.util';

/**
 * Service responsible for scheduling and processing auto-release of funds
 * Runs on a cron schedule to batch process verified deals ready for auto-release
 */
export class AutoReleaseSchedulerService {
  private readonly logger = logger;
  private isProcessing = false;
  private isProcessingRefunds = false;
  private readonly batchSize = 100;
  private job: cron.ScheduledTask | null = null;
  private refundJob: cron.ScheduledTask | null = null;
  private readonly autoReleaseSenderService = new AutoReleaseSenderService();

  /**
   * Initialize the scheduler service
   */
  onModuleInit(): void {
    this.logger.info('AutoReleaseSchedulerService initialized');
  }

  /**
   * Start the auto-release processing job
   * Runs every 6 hours to check for verified deals requiring auto-release
   */
  start(): void {
    if (!isPrimaryWorker()) {
      this.logger.info('AutoReleaseSchedulerService: Skipping start (not primary worker)');
      return;
    }

    if (this.job) {
      this.logger.warn('AutoReleaseSchedulerService: Job already started');
      return;
    }

    // Run every 6 hours
    this.job = cron.schedule('0 */6 * * *', async () => {
      await this.processAutoReleasesFundsFromEscrowWalletToChannelOwner();
    });

    // Run refund job every 6 hours (offset by 3 hours from release job)
    this.refundJob = cron.schedule('0 3,9,15,21 * * *', async () => {
      await this.processRefundsForDeclinedOrVerificationFailedDeals();
    });

    this.logger.info('AutoReleaseSchedulerService: Auto-release job started (runs every 6 hours)');
    this.logger.info('AutoReleaseSchedulerService: Refund job started (runs every 6 hours)');
  }

  /**
   * Stop the auto-release processing job
   */
  stop(): void {
    if (this.job) {
      this.job.stop();
      this.job = null;
      this.logger.info('AutoReleaseSchedulerService: Auto-release job stopped');
    }
    if (this.refundJob) {
      this.refundJob.stop();
      this.refundJob = null;
      this.logger.info('AutoReleaseSchedulerService: Refund job stopped');
    }
  }

  /**
   * Process verified deals that require auto-release
   * Uses a flag to prevent concurrent processing
   */
  private async processAutoReleasesFundsFromEscrowWalletToChannelOwner(): Promise<void> {
    if (this.isProcessing) {
      this.logger.debug('AutoReleaseSchedulerService: Already processing, skipping');
      return;
    }

    this.isProcessing = true;

    try {
      const deals = await DealModel.findVerifiedDealsForAutoRelease(this.batchSize);

      if (deals.length === 0) {
        return;
      }

      this.logger.info(`Processing ${deals.length} verified deals for auto-release`);

      const userIds = new Set<number>();
      deals.forEach((deal: any) => {
        userIds.add(deal.advertiser_id);
        userIds.add(deal.channel_owner_id);
      });
      const usersMap = await UserModel.findByIds(Array.from(userIds));


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

          const result = await this.autoReleaseSenderService.releaseFundsFromEscrowToChannelOwner(deal);

          if (result.success) {
            this.logger.info(`Successfully auto-released funds for Deal #${deal.id}`, {
              dealId: deal.id,
              txHash: result.txHash,
            });
          } else {
            if (result.error?.reason === 'ConcurrentProcessing' || result.error?.reason === 'NoReleaseNeeded') {
              this.logger.debug(`Deal #${deal.id} auto-release skipped`, {
                dealId: deal.id,
                reason: result.error.reason,
              });
            } else {
              this.logger.error(`Failed to auto-release funds for Deal #${deal.id}`, {
                dealId: deal.id,
                error: result.error,
              });
            }
          }
        } catch (error: any) {
          this.logger.error(`Error processing auto-release for Deal #${deal.id}`, {
            dealId: deal.id,
            error: error.message,
            stack: error.stack,
          });
        }
      }

      this.logger.info(`Processed ${deals.length} auto-release deals`);
    } catch (error: any) {
      this.logger.error('Error processing auto-releases', {
        error: error.message,
        stack: error.stack,
      });
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process declined deals that require refund to advertiser
   * Uses a flag to prevent concurrent processing
   */
  private async processRefundsForDeclinedOrVerificationFailedDeals(): Promise<void> {
    if (this.isProcessingRefunds) {
      this.logger.debug('AutoReleaseSchedulerService: Already processing refunds, skipping');
      return;
    }

    this.isProcessingRefunds = true;

    try {
      const deals = await DealModel.findDeclinedOrVerificationFailedDeals(this.batchSize);

      if (deals.length === 0) {
        return;
      }

      this.logger.info(`Processing ${deals.length} declined deals for refund`);

      const userIds = new Set<number>();
      deals.forEach((deal: any) => {
        userIds.add(deal.advertiser_id);
        userIds.add(deal.channel_owner_id);
      });
      const usersMap = await UserModel.findByIds(Array.from(userIds));

      for (const deal of deals) {
        try {
          const advertiser = usersMap.get(deal.advertiser_id);

          if (!advertiser) {
            this.logger.warn(`Deal #${deal.id}: Missing advertiser data`, {
              dealId: deal.id,
              advertiserId: deal.advertiser_id,
            });
            continue;
          }

          const advertiserWalletAddress = (advertiser as any).wallet_address;

          if (!advertiserWalletAddress) {
            this.logger.warn(`Deal #${deal.id}: Missing advertiser wallet address`, {
              dealId: deal.id,
              advertiserId: deal.advertiser_id,
            });
            continue;
          }

          if (!deal.escrow_address) {
            this.logger.warn(`Deal #${deal.id}: Missing escrow address`, {
              dealId: deal.id,
            });
            continue;
          }

          const result = await this.autoReleaseSenderService.refundFundsFromEscrowToAdvertiser(
            deal,
            advertiserWalletAddress
          );

          if (result.success) {
            this.logger.info(`Successfully refunded funds for Deal #${deal.id}`, {
              dealId: deal.id,
              txHash: result.txHash,
            });
          } else {
            if (result.error?.reason === 'ConcurrentProcessing' || result.error?.reason === 'NoRefundNeeded') {
              this.logger.debug(`Deal #${deal.id} refund skipped`, {
                dealId: deal.id,
                reason: result.error.reason,
              });
            } else {
              this.logger.error(`Failed to refund funds for Deal #${deal.id}`, {
                dealId: deal.id,
                error: result.error,
              });
            }
          }
        } catch (error: any) {
          this.logger.error(`Error processing refund for Deal #${deal.id}`, {
            dealId: deal.id,
            error: error.message,
            stack: error.stack,
          });
        }
      }

      this.logger.info(`Processed ${deals.length} refund deals`);
    } catch (error: any) {
      this.logger.error('Error processing refunds', {
        error: error.message,
        stack: error.stack,
      });
    } finally {
      this.isProcessingRefunds = false;
    }
  }
}
