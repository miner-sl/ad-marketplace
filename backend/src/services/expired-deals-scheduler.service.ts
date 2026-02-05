import * as cron from 'node-cron';
import logger from '../utils/logger';
import { DealModel } from '../repositories/deal-model.repository';
import { UserModel } from '../repositories/user.repository';
import { ExpiredDealsSenderService } from './expired-deals-sender.service';
import { isPrimaryWorker } from '../utils/cluster.util';

/**
 * Service responsible for scheduling and processing expired deals
 * Runs on a cron schedule to batch decline deals that have timed out
 */
export class ExpiredDealsSchedulerService {
  private readonly logger = logger;
  private isProcessing = false;
  private readonly batchSize = 100;
  private job: cron.ScheduledTask | null = null;

  /**
   * Initialize the scheduler service
   */
  onModuleInit(): void {
    this.logger.info('ExpiredDealsSchedulerService initialized');
  }

  /**
   * Start the expired deals processing job
   * Runs every 10 minutes to check for expired deals
   */
  start(): void {
    if (!isPrimaryWorker()) {
      this.logger.info('ExpiredDealsSchedulerService: Skipping start (not primary worker)');
      return;
    }

    if (this.job) {
      this.logger.warn('ExpiredDealsSchedulerService: Job already started');
      return;
    }

    // Run every 10 minutes
    this.job = cron.schedule('*/10 * * * *', async () => {
      await this.processExpiredDeals();
    });

    this.logger.info('ExpiredDealsSchedulerService: Expired deals job started (runs every 10 minutes)');
  }

  /**
   * Stop the expired deals processing job
   */
  stop(): void {
    if (this.job) {
      this.job.stop();
      this.job = null;
      this.logger.info('ExpiredDealsSchedulerService: Expired deals job stopped');
    }
  }

  /**
   * Process deals without activity for 10 days
   */
  private async processExpiredDeals(): Promise<void> {
    if (this.isProcessing) {
      this.logger.debug('ExpiredDealsSchedulerService: Already processing, skipping');
      return;
    }

    this.isProcessing = true;

    try {
      this.logger.debug('Checking for expired deals...');

      const expiredDeals = await DealModel.findWithoutActivity(this.batchSize);

      if (expiredDeals.length === 0) {
        return;
      }

      this.logger.info(`Processing ${expiredDeals.length} expired deals`);

      const userIds = new Set<number>();
      expiredDeals.forEach((deal: any) => {
        userIds.add(deal.advertiser_id);
        userIds.add(deal.channel_owner_id);
      });
      const usersMap = await UserModel.findByIds(Array.from(userIds));

      const expiredDealsSenderService = new ExpiredDealsSenderService();

      for (const deal of expiredDeals) {
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

          const result = await expiredDealsSenderService.declineExpiredDeal(
            deal,
            advertiser,
            channelOwner
          );

          if (result.success) {
            this.logger.info(`Successfully declined expired Deal #${deal.id}`, {
              dealId: deal.id,
            });
          } else {
            this.logger.error(`Failed to decline expired Deal #${deal.id}`, {
              dealId: deal.id,
              error: result.error,
            });
          }
        } catch (error: any) {
          this.logger.error(`Error processing expired Deal #${deal.id}`, {
            dealId: deal.id,
            error: error.message,
            stack: error.stack,
          });
        }
      }

      this.logger.info(`Processed ${expiredDeals.length} expired deals`);
    } catch (error: any) {
      this.logger.error('Error processing expired deals', {
        error: error.message,
        stack: error.stack,
      });
    } finally {
      this.isProcessing = false;
    }
  }
}
