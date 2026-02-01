import { Router } from 'express';
import { DealModel } from '../models/Deal';
import { DealRepository } from '../repositories/DealRepository';
import { CreativeRepository } from '../repositories/CreativeRepository';
import { DealFlowService } from '../services/dealFlow';
import { UserModel } from '../models/User';
import { validate, validateQuery } from '../middleware/validation';
import { createDealSchema, confirmPaymentSchema, submitCreativeSchema, listDealsQuerySchema, dealRequestsQuerySchema } from '../utils/validation';

const dealsRouter = Router();

// List deals
dealsRouter.get('/', validateQuery(listDealsQuerySchema), async (req, res) => {
  try {
    const { user_id, status, deal_type, limit } = req.query;
    let deals;

    if (user_id) {
      const telegramId = req.query.user_id as string;
      console.log(req.query);
      const user = await UserModel.findByTelegramId(Number(telegramId));
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      deals = await DealModel.findByUser(user.id);
    } else {
      deals = await DealRepository.listDealsWithFilters({
        status: status as string | undefined,
        deal_type: deal_type as string | undefined,
        limit: (limit as unknown as number) || 20,
      });
    }

    res.json(deals);
  } catch (error: any) {
    console.log(error)
    res.status(500).json({ error: error.message });
  }
});

// Get deal requests for channel owner by Telegram ID
dealsRouter.get('/requests', validateQuery(dealRequestsQuerySchema), async (req, res) => {
  try {
    const { telegram_id, limit } = req?.query;
    const dealsLimit = limit || 20;

    const deals = await DealFlowService.findDealRequestByTelegramId(telegram_id, dealsLimit);
    res.json(deals);
  } catch (error: any) {
    if (error.message === 'User not found') {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

// Get deal details
dealsRouter.get('/:id', async (req, res) => {
  try {
    const deal = await DealModel.findByIdWithChannel(parseInt(req.params.id));
    if (!deal) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    let user = null;
    const { user_id } = req.query;
    if (user_id) {
      const telegramIdStr = typeof user_id === 'string' ? user_id : String(user_id);
      const telegramId = Number(telegramIdStr);
      if (!isNaN(telegramId)) {
        user = await UserModel.findByTelegramId(telegramId);
        if (user) {
          const isAuthorized =
            deal.channel_owner_id === user.id ||
            deal.advertiser_id === user.id;

          if (!isAuthorized) {
            return res.status(403).json({ error: 'Unauthorized: You are not authorized to view this deal' });
          }
        }
      }
    }

    // Get messages and creative using repositories
    const messages = await DealRepository.getMessages(deal.id);
    const creative = await CreativeRepository.findByDeal(deal.id);

    // Remove sensitive field before sending response
    const { channel_owner_wallet_address, ...dealWithoutWallet } = deal;

    res.json({
      ...dealWithoutWallet,
      owner: user !== null ? user?.id === deal.channel_owner_id : false,
      advertiser: user !== null ? user?.id === deal.advertiser_id : false,
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
      publish_date,
      postText,
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
      publish_date: publish_date ? new Date(publish_date) : undefined,
      postText,
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
