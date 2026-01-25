import { DealModel } from '../models/Deal';
import { ChannelModel } from '../models/Channel';
import { TONService } from './ton';
import { CreativeService } from './creative';
import db from '../db/connection';

export class DealFlowService {
  /**
   * Accept deal (channel owner accepts advertiser request)
   */
  static async acceptDeal(dealId: number, channelOwnerId: number, telegramUserId?: number): Promise<any> {
    const deal = await DealModel.findById(dealId);
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

    if (deal.status !== 'pending' && deal.status !== 'negotiating') {
      throw new Error(`Cannot accept deal in status: ${deal.status}`);
    }

    // Get channel owner wallet address
    const channelOwner = await db.query('SELECT wallet_address FROM users WHERE id = $1', [channelOwnerId]);
    const ownerWalletAddress = channelOwner.rows[0]?.wallet_address;

    if (!ownerWalletAddress) {
      throw new Error('Channel owner wallet address not set. Please set your wallet address first.');
    }

    // Generate escrow address for this deal
    const escrowAddress = await TONService.generateEscrowAddress(dealId);

    // Update deal with escrow address and owner wallet address
    await db.query(
      `UPDATE deals 
       SET escrow_address = $1, channel_owner_wallet_address = $2, status = 'payment_pending', updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [escrowAddress, ownerWalletAddress, dealId]
    );

    const updated = await DealModel.findById(dealId);
    
    await db.query(
      `INSERT INTO deal_messages (deal_id, sender_id, message_text)
       VALUES ($1, $2, $3)`,
      [dealId, channelOwnerId, 'Deal accepted. Waiting for payment.']
    );

    return updated;
  }

  /**
   * Advertiser confirms payment (manual confirmation)
   */
  static async confirmPayment(dealId: number, txHash: string): Promise<any> {
    const deal = await DealModel.findById(dealId);
    if (!deal) {
      throw new Error('Deal not found');
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

    const updated = await DealModel.confirmPayment(dealId, txHash);
    
    // Update status: if scheduled_post_time is set, move to 'scheduled', otherwise 'paid'
    const finalStatus = updated.scheduled_post_time ? 'scheduled' : 'paid';
    await DealModel.updateStatus(dealId, finalStatus);

    await db.query(
      `INSERT INTO deal_messages (deal_id, sender_id, message_text)
       VALUES ($1, $2, $3)`,
      [dealId, deal.advertiser_id, `Payment confirmed: ${txHash}`]
    );

    return updated;
  }

  /**
   * Submit creative for review
   */
  static async submitCreative(dealId: number, submittedBy: number, content: {
    contentType: string;
    contentData: Record<string, any>;
  }): Promise<any> {
    const deal = await DealModel.findById(dealId);
    if (!deal) {
      throw new Error('Deal not found');
    }

    if (deal.status !== 'paid') {
      throw new Error(`Cannot submit creative in status: ${deal.status}`);
    }

    await CreativeService.create({
      deal_id: dealId,
      submitted_by: submittedBy,
      content_type: content.contentType,
      content_data: content.contentData
    });

    await CreativeService.submit(dealId);
    await DealModel.updateStatus(dealId, 'creative_submitted');

    return await DealModel.findById(dealId);
  }

  /**
   * Advertiser approves creative
   */
  static async approveCreative(dealId: number, advertiserId: number): Promise<any> {
    const deal = await DealModel.findById(dealId);
    if (!deal || deal.advertiser_id !== advertiserId) {
      throw new Error('Deal not found or unauthorized');
    }

    if (deal.status !== 'creative_submitted') {
      throw new Error(`Cannot approve creative in status: ${deal.status}`);
    }

    await CreativeService.approve(dealId);
    
    // Check if payment was already confirmed by checking payment_confirmed_at
    // If payment confirmed, keep paid status, otherwise move to creative_approved
    if (deal.payment_confirmed_at) {
      // Payment already confirmed, keep paid status
      await DealModel.updateStatus(dealId, 'paid');
    } else {
      // Payment not yet confirmed, move to creative_approved
      await DealModel.updateStatus(dealId, 'creative_approved');
    }

    await db.query(
      `INSERT INTO deal_messages (deal_id, sender_id, message_text)
       VALUES ($1, $2, $3)`,
      [dealId, advertiserId, 'Creative approved']
    );

    return await DealModel.findById(dealId);
  }

  /**
   * Request revision of creative
   */
  static async requestRevision(dealId: number, requestedBy: number, notes: string): Promise<any> {
    const deal = await DealModel.findById(dealId);
    if (!deal) {
      throw new Error('Deal not found');
    }

    await CreativeService.requestRevision(dealId, notes);
    await DealModel.updateStatus(dealId, 'negotiating');

    await db.query(
      `INSERT INTO deal_messages (deal_id, sender_id, message_text)
       VALUES ($1, $2, $3)`,
      [dealId, requestedBy, `Revision requested: ${notes}`]
    );

    return await DealModel.findById(dealId);
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
