import { Router } from 'express';
import { DealModel } from '../models/Deal';
import { DealRepository } from '../repositories/DealRepository';
import { CreativeRepository } from '../repositories/CreativeRepository';
import { DealFlowService } from '../services/dealFlow';
import { validate } from '../middleware/validation';
import { createDealSchema, confirmPaymentSchema, submitCreativeSchema } from '../utils/validation';

const dealsRouter = Router();

// List deals
dealsRouter.get('/', async (req, res) => {
  try {
    const { user_id, status, deal_type } = req.query;
    let deals;

    if (user_id) {
      deals = await DealModel.findByUser(parseInt(user_id as string));
    } else {
      deals = await DealRepository.listDealsWithFilters({
        status: status as string | undefined,
        deal_type: deal_type as string | undefined,
        limit: 100,
      });
    }

    res.json(deals);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get deal details
dealsRouter.get('/:id', async (req, res) => {
  try {
    const deal = await DealModel.findById(parseInt(req.params.id));
    if (!deal) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    // Get messages and creative using repositories
    const messages = await DealRepository.getMessages(deal.id);
    const creative = await CreativeRepository.findByDeal(deal.id);

    res.json({
      ...deal,
      messages,
      creative,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create deal
dealsRouter.post('/', validate(createDealSchema), async (req, res) => {
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
dealsRouter.post('/:id/accept', async (req, res) => {
  try {
    const { channel_owner_id } = req.body;
    const deal = await DealFlowService.acceptDeal(parseInt(req.params.id), channel_owner_id);
    res.json(deal);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Confirm payment
dealsRouter.post('/:id/payment', validate(confirmPaymentSchema), async (req, res) => {
  try {
    const { tx_hash } = req.body;
    const deal = await DealFlowService.confirmPayment(parseInt(req.params.id), tx_hash);
    res.json(deal);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Submit creative
dealsRouter.post('/:id/creative', validate(submitCreativeSchema), async (req, res) => {
  try {
    const { channel_owner_id, content_type, content_data } = req.body;
    const creative = await DealFlowService.submitCreative(
      parseInt(req.params.id),
      channel_owner_id,
      { contentType: content_type, contentData: content_data }
    );
    res.json(creative);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Approve creative
dealsRouter.post('/:id/creative/approve', async (req, res) => {
  try {
    const { advertiser_id } = req.body;
    const deal = await DealFlowService.approveCreative(parseInt(req.params.id), advertiser_id);
    res.json(deal);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Request revision
dealsRouter.post('/:id/creative/revision', async (req, res) => {
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
dealsRouter.post('/:id/schedule', async (req, res) => {
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
dealsRouter.post('/:id/cancel', async (req, res) => {
  try {
    const deal = await DealModel.cancel(parseInt(req.params.id));
    res.json(deal);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default dealsRouter;
