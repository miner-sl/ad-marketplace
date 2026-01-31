import { Router } from 'express';
import { CampaignRepository } from '../repositories/CampaignRepository';
import { UserModel } from '../models/User';
import { validate } from '../middleware/validation';
import { createCampaignSchema } from '../utils/validation';

const campaignsRouter = Router();

// List campaigns with filters
campaignsRouter.get('/', async (req, res) => {
  try {
    const {
      advertiser_id,
      status,
      min_budget,
      max_budget,
      limit = 50,
      offset = 0,
    } = req.query;

    const filters = {
      advertiser_id: advertiser_id ? parseInt(advertiser_id as string) : undefined,
      status: status as string | undefined,
      min_budget: min_budget ? parseFloat(min_budget as string) : undefined,
      max_budget: max_budget ? parseFloat(max_budget as string) : undefined,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    };

    const campaigns = await CampaignRepository.listCampaignsWithFilters(filters);
    res.json(campaigns);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get campaign details
campaignsRouter.get('/:id', async (req, res) => {
  try {
    const campaign = await CampaignRepository.findById(parseInt(req.params.id));
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    res.json(campaign);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create campaign
campaignsRouter.post('/', validate(createCampaignSchema), async (req, res) => {
  try {
    const {
      telegram_id,
      title,
      description,
      budget_ton,
      target_subscribers_min,
      target_subscribers_max,
      target_views_min,
      target_languages,
      preferred_formats,
    } = req.body;

    const user = await UserModel.findOrCreate({
      telegram_id,
      username: req.body.username,
      first_name: req.body.first_name,
      last_name: req.body.last_name,
    });

    await UserModel.updateRole(telegram_id, 'advertiser', true);

    const campaign = await CampaignRepository.create({
      advertiser_id: user.id,
      title,
      description,
      budget_ton: budget_ton ? parseFloat(budget_ton) : undefined,
      target_subscribers_min: target_subscribers_min ? parseInt(target_subscribers_min) : undefined,
      target_subscribers_max: target_subscribers_max ? parseInt(target_subscribers_max) : undefined,
      target_views_min: target_views_min ? parseInt(target_views_min) : undefined,
      target_languages,
      preferred_formats,
    });

    res.json(campaign);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update campaign
campaignsRouter.put('/:id', async (req, res) => {
  try {
    const {
      title,
      description,
      budget_ton,
      target_subscribers_min,
      target_subscribers_max,
      status,
    } = req.body;

    const campaign = await CampaignRepository.update(parseInt(req.params.id), {
      title,
      description,
      budget_ton: budget_ton ? parseFloat(budget_ton) : undefined,
      target_subscribers_min: target_subscribers_min ? parseInt(target_subscribers_min) : undefined,
      target_subscribers_max: target_subscribers_max ? parseInt(target_subscribers_max) : undefined,
      status,
    });

    res.json(campaign);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default campaignsRouter;
