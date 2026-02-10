import * as cron from 'node-cron';

import {AutoPostSchedulerService} from '../services/auto-post-scheduler.service';
import {AutoReleaseSchedulerService} from '../services/auto-release-scheduler.service';
import {VerificationSchedulerService} from '../services/verification-scheduler.service';
import {TonEscrowPaymentPollingService} from '../services/ton-escrow-payment-polling.service';
import {
  TelegramChannelStatsRefreshSchedulerService
} from '../services/telegram-channel-stats-refresh-scheduler.service';
import {ExpiredDealsSchedulerService} from '../services/expired-deals-scheduler.service';
import {EscrowAddressSchedulerService} from '../services/escrow-address-scheduler.service';

import logger from '../utils/logger';
import {isPrimaryWorker} from '../utils/cluster.util';

export class CronJobsSchedulerService {
  private static jobs: cron.ScheduledTask[] = [];
  private static postSchedulerService: AutoPostSchedulerService | null = null;
  private static autoReleaseSchedulerService: AutoReleaseSchedulerService | null = null;
  private static verificationSchedulerService: VerificationSchedulerService | null = null;
  private static tonEscrowPaymentPollingService: TonEscrowPaymentPollingService | null = null;
  private static telegramChannelStatsRefreshSchedulerService: TelegramChannelStatsRefreshSchedulerService | null = null;
  private static expiredDealsSchedulerService: ExpiredDealsSchedulerService | null = null;
  private static escrowAddressSchedulerService: EscrowAddressSchedulerService | null = null;

  /**
   * Start all cron jobs
   */
  static startAll() {
    if (!isPrimaryWorker()) {
      return;
    }
    logger.info('Starting cron jobs...');

    // Auto-release funds for verified deals (buyer didn't confirm)
    this.postSchedulerService = new AutoPostSchedulerService();
    this.postSchedulerService.onModuleInit();
    this.postSchedulerService.start();

    // Check for scheduled posts every 5 minutes
    this.autoReleaseSchedulerService = new AutoReleaseSchedulerService();
    this.autoReleaseSchedulerService.onModuleInit();
    this.autoReleaseSchedulerService.start();

    // Check for posts ready for verification every hour
    this.verificationSchedulerService = new VerificationSchedulerService();
    this.verificationSchedulerService.onModuleInit();
    this.verificationSchedulerService.start();

    this.tonEscrowPaymentPollingService = new TonEscrowPaymentPollingService();
    this.tonEscrowPaymentPollingService.onModuleInit();
    this.tonEscrowPaymentPollingService.start();

    // Refresh channel stats daily at 2 AM
    this.telegramChannelStatsRefreshSchedulerService = new TelegramChannelStatsRefreshSchedulerService();
    this.telegramChannelStatsRefreshSchedulerService.onModuleInit();
    this.telegramChannelStatsRefreshSchedulerService.start();

    // Initialize expired deals scheduler service
    this.expiredDealsSchedulerService = new ExpiredDealsSchedulerService();
    this.expiredDealsSchedulerService.onModuleInit();
    this.expiredDealsSchedulerService.start();

    // Initialize escrow address scheduler service
    this.escrowAddressSchedulerService = new EscrowAddressSchedulerService();
    this.escrowAddressSchedulerService.onModuleInit();
    this.escrowAddressSchedulerService.start();

    // TODO maybe need to merge some jobs into one
    // TODO scalable jobs

    logger.info(`Started ${this.jobs.length} cron job(s) + PostSchedulerService + AutoReleaseSchedulerService + VerificationSchedulerService + TonEscrowPaymentPollingService + TelegramChannelStatsRefreshSchedulerService + ExpiredDealsSchedulerService + EscrowAddressSchedulerService`);
  }

  /**
   * Stop all cron jobs
   */
  static stopAll() {
    this.jobs.forEach(job => job.stop());
    this.jobs = [];

    if (this.postSchedulerService) {
      this.postSchedulerService.stop();
      this.postSchedulerService = null;
    }

    if (this.autoReleaseSchedulerService) {
      this.autoReleaseSchedulerService.stop();
      this.autoReleaseSchedulerService = null;
    }

    if (this.verificationSchedulerService) {
      this.verificationSchedulerService.stop();
      this.verificationSchedulerService = null;
    }

    if (this.tonEscrowPaymentPollingService) {
      this.tonEscrowPaymentPollingService.stop();
      this.tonEscrowPaymentPollingService = null;
    }

    if (this.telegramChannelStatsRefreshSchedulerService) {
      this.telegramChannelStatsRefreshSchedulerService.stop();
      this.telegramChannelStatsRefreshSchedulerService = null;
    }

    if (this.expiredDealsSchedulerService) {
      this.expiredDealsSchedulerService.stop();
      this.expiredDealsSchedulerService = null;
    }

    if (this.escrowAddressSchedulerService) {
      this.escrowAddressSchedulerService.stop();
      this.escrowAddressSchedulerService = null;
    }

    logger.info('Stopped all cron jobs');
  }
}
