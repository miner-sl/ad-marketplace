import * as cron from 'node-cron';

import { DealFlowService } from './deal-flow.service';
import { DealRepository } from '../repositories/deal.repository';
import { UserModel} from '../repositories/user.repository';

import { isPrimaryWorker } from '../utils/cluster.util';
import logger from '../utils/logger';
import type { User } from '../models/user.types';

export class EscrowAddressSchedulerService {
  private readonly logger = logger;
  private isProcessing = false;
  private readonly batchSize = 10;
  private job: cron.ScheduledTask | null = null;

  onModuleInit(): void {
    this.logger.info('EscrowAddressSchedulerService initialized');
  }

  /**
   * Runs every 5 minutes to check for deals that need escrow addresses
   */
  start(): void {
    if (!isPrimaryWorker()) {
      this.logger.info('EscrowAddressSchedulerService: Skipping start (not primary worker)');
      return;
    }

    if (this.job) {
      this.logger.warn('EscrowAddressSchedulerService: Job already started');
      return;
    }
    // void this.processDealsNeedingEscrow();
    this.job = cron.schedule('*/1 * * * *', async () => {
      await this.processDealsNeedingEscrow();
    });

    this.logger.info('EscrowAddressSchedulerService: Escrow address job started (runs every 5 minutes)');
  }

  stop(): void {
    if (this.job) {
      this.job.stop();
      this.job = null;
      this.logger.info('EscrowAddressSchedulerService: Escrow address job stopped');
    }
  }

  private async processDealsNeedingEscrow(): Promise<void> {
    if (this.isProcessing) {
      this.logger.debug('EscrowAddressSchedulerService: Already processing, skipping');
      return;
    }

    this.isProcessing = true;

    try {
      this.logger.debug('Checking for deals needing escrow addresses...');
      const deals = await DealRepository.findDealsNeedingEscrow(this.batchSize);
      if (deals.length === 0) {
        return;
      }

      this.logger.info(`Processing ${deals.length} deals needing escrow addresses`);

      for (const deal of deals) {
        try {
          const owner: User|null = await UserModel.findById(deal.channel_owner_id)
          if (!owner?.wallet_address) {
            this.logger.warn(`Deal #${deal.id}: Channel owner wallet address not set, skipping`, {
              dealId: deal.id,
              status: deal.status,
            });
            continue;
          }

          await DealFlowService.generateEscrowAddress(deal, owner.wallet_address);

          this.logger.info(`Successfully generated escrow address for Deal #${deal.id}`, {
            dealId: deal.id,
          });
        } catch (error: any) {
          this.logger.error(`Failed to generate escrow address for Deal #${deal.id}`, {
            dealId: deal.id,
            error: error.message,
            stack: error.stack,
          });
        }
      }
    } catch (error: any) {
      this.logger.error('Error processing deals needing escrow addresses', {
        error: error.message,
        stack: error.stack,
      });
    } finally {
      this.isProcessing = false;
    }
  }
}
