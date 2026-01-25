import { DealModel } from '../models/Deal';
import { ChannelModel } from '../models/Channel';
import { TONService } from './ton';
import { CreativeService } from './creative';
import { withTx } from '../utils/transaction';

export class DealFlowService {
  /**
   * Initialize/create a new deal
   */
  static async initializeDeal(data: {
    deal_type: 'listing' | 'campaign';
    listing_id?: number;
    campaign_id?: number;
    channel_id: number;
    channel_owner_id: number;
    advertiser_id: number;
    ad_format: string;
    price_ton: number;
    timeout_hours?: number;
  }): Promise<any> {
    return await DealModel.create(data);
  }

  /**
   * Schedule post for a deal
   */
  static async schedulePost(dealId: number, postTime: Date): Promise<any> {
    const deal = await DealModel.findById(dealId);
    if (!deal) {
      throw new Error('Deal not found');
    }

    if (deal.status !== 'paid' && deal.status !== 'scheduled') {
      throw new Error(`Cannot schedule post in status: ${deal.status}`);
    }

    return await DealModel.schedulePost(dealId, postTime);
  }

  /**
   * Accept deal (channel owner accepts advertiser request)
   * Uses transaction to ensure atomicity
   */
  static async acceptDeal(dealId: number, channelOwnerId: number, telegramUserId?: number): Promise<any> {
    return await withTx(async (client) => {
      // Lock deal row to prevent race conditions
      const dealResult = await client.query(
        `SELECT * FROM deals WHERE id = $1 FOR UPDATE`,
        [dealId]
      );
      
      const deal = dealResult.rows[0];
      if (!deal || deal.channel_owner_id !== channelOwnerId) {
        throw new Error('Deal not found or unauthorized');
      }

      // Verify user is still admin of the channel (for financial operations)
      if (telegramUserId) {
        const isAdmin = await ChannelModel.verifyAdminStatus(
          deal.channel_id,
          channelOwnerId,
          telegramUserId
        );
        if (!isAdmin) {
          throw new Error('You are no longer an admin of this channel');
        }
      }

      // Check status atomically within transaction
      if (deal.status !== 'pending' && deal.status !== 'negotiating') {
        throw new Error(`Cannot accept deal in status: ${deal.status}`);
      }

      // Get channel owner wallet address
      const channelOwner = await client.query('SELECT wallet_address FROM users WHERE id = $1', [channelOwnerId]);
      const ownerWalletAddress = channelOwner.rows[0]?.wallet_address;

      if (!ownerWalletAddress) {
        throw new Error('Channel owner wallet address not set. Please set your wallet address first.');
      }

      // Generate escrow address for this deal
      const escrowAddress = await TONService.generateEscrowAddress(dealId);

      // Update deal with escrow address and owner wallet address (atomic)
      const updateResult = await client.query(
        `UPDATE deals 
         SET escrow_address = $1, channel_owner_wallet_address = $2, status = 'payment_pending', updated_at = CURRENT_TIMESTAMP
         WHERE id = $3 AND status IN ('pending', 'negotiating')
         RETURNING *`,
        [escrowAddress, ownerWalletAddress, dealId]
      );

      if (updateResult.rows.length === 0) {
        throw new Error('Deal status changed during processing');
      }

      const updated = updateResult.rows[0];
      
      // Insert message in same transaction
      await client.query(
        `INSERT INTO deal_messages (deal_id, sender_id, message_text)
         VALUES ($1, $2, $3)`,
        [dealId, channelOwnerId, 'Deal accepted. Waiting for payment.']
      );

      return updated;
    });
  }

  /**
   * Advertiser confirms payment (manual confirmation)
   * Uses atomic UPDATE to prevent race conditions and double processing
   */
  static async confirmPayment(dealId: number, txHash: string): Promise<any> {
    return await withTx(async (client) => {
      // Lock deal row to prevent race conditions
      const dealResult = await client.query(
        `SELECT * FROM deals WHERE id = $1 FOR UPDATE`,
        [dealId]
      );
      
      const deal = dealResult.rows[0];
      if (!deal) {
        throw new Error('Deal not found');
      }

      // Check status atomically
      if (deal.status !== 'payment_pending') {
        throw new Error(`Cannot confirm payment in status: ${deal.status}`);
      }

      // Verify payment on blockchain
      if (deal.escrow_address) {
        const paymentCheck = await TONService.checkPayment(
          deal.escrow_address,
          deal.price_ton.toString()
        );
        
        if (!paymentCheck.received) {
          throw new Error('Payment not confirmed on blockchain');
        }
      }

      // Atomic update: set payment info and status in one query
      const finalStatus = deal.scheduled_post_time ? 'scheduled' : 'paid';
      const updateResult = await client.query(
        `UPDATE deals 
         SET status = $1, payment_tx_hash = $2, payment_confirmed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3 AND status = 'payment_pending'
         RETURNING *`,
        [finalStatus, txHash, dealId]
      );

      if (updateResult.rows.length === 0) {
        throw new Error('Payment already confirmed or deal status changed');
      }

      const updated = updateResult.rows[0];

      // Insert message in same transaction
      await client.query(
        `INSERT INTO deal_messages (deal_id, sender_id, message_text)
         VALUES ($1, $2, $3)`,
        [dealId, deal.advertiser_id, `Payment confirmed: ${txHash}`]
      );

      return updated;
    });
  }

  /**
   * Submit creative for review
   */
  static async submitCreative(dealId: number, submittedBy: number, content: {
    contentType: string;
    contentData: Record<string, any>;
  }): Promise<any> {
    return await withTx(async (client) => {
      // Lock deal row
      const dealResult = await client.query(
        `SELECT * FROM deals WHERE id = $1 FOR UPDATE`,
        [dealId]
      );

      const deal = dealResult.rows[0];
      if (!deal) {
        throw new Error('Deal not found');
      }

      if (deal.status !== 'paid') {
        throw new Error(`Cannot submit creative in status: ${deal.status}`);
      }

      // Create creative (this should also use transaction, but for now we'll do it here)
      await CreativeService.create({
        deal_id: dealId,
        submitted_by: submittedBy,
        content_type: content.contentType,
        content_data: content.contentData
      });

      await CreativeService.submit(dealId);
      
      // Update deal status atomically
      const updateResult = await client.query(
        `UPDATE deals 
         SET status = 'creative_submitted', updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND status = 'paid'
         RETURNING *`,
        [dealId]
      );

      if (updateResult.rows.length === 0) {
        throw new Error('Deal status changed during creative submission');
      }

      return updateResult.rows[0];
    });
  }

  /**
   * Advertiser approves creative
   */
  static async approveCreative(dealId: number, advertiserId: number): Promise<any> {
    return await withTx(async (client) => {
      // Lock deal row
      const dealResult = await client.query(
        `SELECT * FROM deals WHERE id = $1 FOR UPDATE`,
        [dealId]
      );

      const deal = dealResult.rows[0];
      if (!deal || deal.advertiser_id !== advertiserId) {
        throw new Error('Deal not found or unauthorized');
      }

      if (deal.status !== 'creative_submitted') {
        throw new Error(`Cannot approve creative in status: ${deal.status}`);
      }

      await CreativeService.approve(dealId);
      
      // Check if payment was already confirmed by checking payment_confirmed_at
      // If payment confirmed, keep paid status, otherwise move to creative_approved
      const finalStatus = deal.payment_confirmed_at ? 'paid' : 'creative_approved';
      
      // Atomic update
      const updateResult = await client.query(
        `UPDATE deals 
         SET status = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2 AND status = 'creative_submitted'
         RETURNING *`,
        [finalStatus, dealId]
      );

      if (updateResult.rows.length === 0) {
        throw new Error('Deal status changed during creative approval');
      }

      // Insert message in same transaction
      await client.query(
        `INSERT INTO deal_messages (deal_id, sender_id, message_text)
         VALUES ($1, $2, $3)`,
        [dealId, advertiserId, 'Creative approved']
      );

      return updateResult.rows[0];
    });
  }

  /**
   * Request revision of creative
   */
  static async requestRevision(dealId: number, requestedBy: number, notes: string): Promise<any> {
    return await withTx(async (client) => {
      // Lock deal row
      const dealResult = await client.query(
        `SELECT * FROM deals WHERE id = $1 FOR UPDATE`,
        [dealId]
      );

      const deal = dealResult.rows[0];
      if (!deal) {
        throw new Error('Deal not found');
      }

      await CreativeService.requestRevision(dealId, notes);
      
      // Atomic update
      const updateResult = await client.query(
        `UPDATE deals 
         SET status = 'negotiating', updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING *`,
        [dealId]
      );

      if (updateResult.rows.length === 0) {
        throw new Error(`Deal #${dealId} not found`);
      }

      // Insert message in same transaction
      await client.query(
        `INSERT INTO deal_messages (deal_id, sender_id, message_text)
         VALUES ($1, $2, $3)`,
        [dealId, requestedBy, `Revision requested: ${notes}`]
      );

      return updateResult.rows[0];
    });
  }

  /**
   * Verify post and release funds
   */
  static async verifyAndRelease(dealId: number): Promise<any> {
    const deal = await DealModel.findById(dealId);
    if (!deal) {
      throw new Error('Deal not found');
    }

    if (!deal.escrow_address || !deal.channel_owner_wallet_address) {
      throw new Error('Escrow or recipient address not set');
    }

    // Verify post exists (simplified for MVP)
    const verified = true; // Would check actual post in production

    if (verified) {
      // Release funds to channel owner
      await TONService.releaseFunds(
        deal.escrow_address,
        deal.channel_owner_wallet_address,
        deal.price_ton.toString()
      );

      await DealModel.updateStatus(dealId, 'verified');
      await DealModel.updateStatus(dealId, 'completed');
    } else {
      // Refund to advertiser
      // Would need advertiser address in production
      await DealModel.updateStatus(dealId, 'refunded');
    }

    return await DealModel.findById(dealId);
  }
}
