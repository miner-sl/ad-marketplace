import * as cron from 'node-cron';
import logger from '../utils/logger';
import { DealRepository } from '../repositories/deal.repository';
import { UserModel } from '../repositories/user.repository';
import { PostSenderService } from './post-sender.service';
import { isPrimaryWorker } from '../utils/cluster.util';

/**
 * Service responsible for scheduling and processing scheduled posts
 * Runs on a cron schedule to batch process deals ready for publishing
 */
export class AutoPostSchedulerService {
  private readonly logger = logger;
  private isProcessing = false;
  private readonly batchSize = 100;
  private job: cron.ScheduledTask | null = null;

  /**
   * Initialize the scheduler service
   */
  onModuleInit(): void {
    this.logger.info('PostSchedulerService initialized');
  }

  /**
   * Start the scheduled post-processing job
   * Runs every minute to check for deals ready to be published
   */
  start(): void {
    if (!isPrimaryWorker()) {
      this.logger.info('PostSchedulerService: Skipping start (not primary worker)');
      return;
    }

    if (this.job) {
      this.logger.warn('PostSchedulerService: Job already started');
      return;
    }

    // Run every minute
    this.job = cron.schedule('*/1 * * * *', async () => {
      await this.processScheduledPosts();
    });

    this.logger.info('PostSchedulerService: Scheduled post job started (runs every minute)');
  }

  /**
   * Stop the scheduled post processing job
   */
  stop(): void {
    if (this.job) {
      this.job.stop();
      this.job = null;
      this.logger.info('PostSchedulerService: Scheduled post job stopped');
    }
  }

  /**
   * Process scheduled posts that are ready to be published
   * Uses a flag to prevent concurrent processing
   */
  private async processScheduledPosts(): Promise<void> {
    if (this.isProcessing) {
      this.logger.debug('PostSchedulerService: Already processing, skipping');
      return;
    }

    this.isProcessing = true;

    try {
      const pendingPosts = await DealRepository.findPendingScheduledPosts(this.batchSize);

      if (pendingPosts.length === 0) {
        return;
      }

      this.logger.info(`Processing ${pendingPosts.length} pending scheduled posts`);

      // Batch fetch channel owners to avoid N+1 queries
      const channelOwnerIds = Array.from(new Set(pendingPosts.map((d: any) => d.channel_owner_id)));
      const usersMap = await UserModel.findByIds(channelOwnerIds);

      const postSenderService = new PostSenderService();

      for (const deal of pendingPosts) {
        try {
          // Check if deal is still valid (might have been processed by another instance)
          // The distributed lock in PostService will handle concurrent processing
          const channelOwner = usersMap.get(deal.channel_owner_id);
          if (!channelOwner) {
            this.logger.warn(`Deal #${deal.id}: Channel owner not found`, {
              dealId: deal.id,
              channelOwnerId: deal.channel_owner_id,
            });
            continue;
          }

          const result = await postSenderService.publishPost(deal);

          if (result.success) {
            this.logger.info(`Successfully published scheduled post for Deal #${deal.id}`, {
              dealId: deal.id,
              messageId: result.messageId,
              postLink: result.postLink,
            });
          } else {
            this.logger.error(`Failed to publish scheduled post for Deal #${deal.id}`, {
              dealId: deal.id,
              error: result.error,
            });
          }
        } catch (error: any) {
          this.logger.error(`Error processing scheduled post for Deal #${deal.id}`, {
            dealId: deal.id,
            error: error.message,
            stack: error.stack,
          });
          // Continue processing other deals even if one fails
        }
      }

      this.logger.info(`Processed ${pendingPosts.length} scheduled posts`);
    } catch (error: any) {
      this.logger.error('Error processing scheduled posts', {
        error: error.message,
        stack: error.stack,
      });
    } finally {
      this.isProcessing = false;
    }
  }
}
