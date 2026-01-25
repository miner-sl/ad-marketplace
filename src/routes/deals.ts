import { Router } from 'express';
import { DealModel } from '../models/Deal';
import { DealFlowService } from '../services/dealFlow';
import { validate } from '../middleware/validation';
import { createDealSchema, confirmPaymentSchema, submitCreativeSchema } from '../utils/validation';
import db from '../db/connection';

const router = Router();

// List deals
router.get('/', async (req, res) => {
  try {
    const { user_id, status, deal_type } = req.query;
    let deals;

    if (user_id) {
      deals = await DealModel.findByUser(parseInt(user_id as string));
    } else {
      const result = await db.query(
        `SELECT * FROM deals 
         WHERE ($1::text IS NULL OR status = $1)
         AND ($2::text IS NULL OR deal_type = $2)
         ORDER BY created_at DESC
         LIMIT 100`,
        [status || null, deal_type || null]
      );
      deals = result.rows;
    }

    res.json(deals);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get deal details
router.get('/:id', async (req, res) => {
  try {
    const deal = await DealModel.findById(parseInt(req.params.id));
    if (!deal) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    // Get messages
    const messages = await db.query(
      'SELECT * FROM deal_messages WHERE deal_id = $1 ORDER BY created_at ASC',
      [deal.id]
    );

    // Get creative if exists
    const creative = await db.query(
      'SELECT * FROM creatives WHERE deal_id = $1 ORDER BY created_at DESC LIMIT 1',
      [deal.id]
    );

    res.json({
      ...deal,
      messages: messages.rows,
      creative: creative.rows[0] || null,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create deal
router.post('/', validate(createDealSchema), async (req, res) => {
  try {
    const {
      deal_type,
      listing_id,
      campaign_id,
      channel_id,
      channel_owner_id,
      advertiser_id,
      ad_format,
      price_ton,
    } = req.body;

    const result = await DealFlowService.initializeDeal({
      deal_type,
      listing_id,
      campaign_id,
      channel_id,
      channel_owner_id,
      advertiser_id,
      ad_format,
      price_ton: parseFloat(price_ton),
    });

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Accept deal
router.post('/:id/accept', async (req, res) => {
  try {
    const { channel_owner_id } = req.body;
    const deal = await DealFlowService.acceptDeal(parseInt(req.params.id), channel_owner_id);
    res.json(deal);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Confirm payment
router.post('/:id/payment', validate(confirmPaymentSchema), async (req, res) => {
  try {
    const { tx_hash } = req.body;
    const deal = await DealFlowService.confirmPayment(parseInt(req.params.id), tx_hash);
    res.json(deal);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Submit creative
router.post('/:id/creative', validate(submitCreativeSchema), async (req, res) => {
  try {
    const { channel_owner_id, content_type, content_data } = req.body;
    const creative = await DealFlowService.submitCreative(
      parseInt(req.params.id),
      channel_owner_id,
      { content_type, content_data }
    );
    res.json(creative);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Approve creative
router.post('/:id/creative/approve', async (req, res) => {
  try {
    const { advertiser_id } = req.body;
    const deal = await DealFlowService.approveCreative(parseInt(req.params.id), advertiser_id);
    res.json(deal);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Request revision
router.post('/:id/creative/revision', async (req, res) => {
  try {
    const { advertiser_id, notes } = req.body;
    const deal = await DealFlowService.requestRevision(
      parseInt(req.params.id),
      advertiser_id,
      notes
    );
    res.json(deal);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Schedule post
router.post('/:id/schedule', async (req, res) => {
  try {
    const { post_time } = req.body;
    const deal = await DealFlowService.schedulePost(
      parseInt(req.params.id),
      new Date(post_time)
    );
    res.json(deal);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Cancel deal
router.post('/:id/cancel', async (req, res) => {
  try {
    const deal = await DealModel.cancel(parseInt(req.params.id));
    res.json(deal);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
