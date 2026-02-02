import { FastifyPluginAsync } from 'fastify';
import { CampaignRepository } from '../repositories/CampaignRepository';
import { UserModel } from '../models/User';
import { validateBody } from '../middleware/validation';
import { createCampaignSchema } from '../utils/validation';

const campaignsRouter: FastifyPluginAsync = async (fastify) => {
  // List campaigns with filters
  fastify.get('/', async (request, reply) => {
    try {
      const {
        advertiser_id,
        status,
        min_budget,
        max_budget,
        limit = 50,
        offset = 0,
      } = request.query as any;

      const filters = {
        advertiser_id: advertiser_id ? parseInt(advertiser_id as string) : undefined,
        status: status as string | undefined,
        min_budget: min_budget ? parseFloat(min_budget as string) : undefined,
        max_budget: max_budget ? parseFloat(max_budget as string) : undefined,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      };

      const campaigns = await CampaignRepository.listCampaignsWithFilters(filters);
      return campaigns;
    } catch (error: any) {
      reply.code(500).send({ error: error.message });
    }
  });

  // Get campaign details
  fastify.get('/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const campaign = await CampaignRepository.findById(parseInt(id));
      if (!campaign) {
        return reply.code(404).send({ error: 'Campaign not found' });
      }
      return campaign;
    } catch (error: any) {
      reply.code(500).send({ error: error.message });
    }
  });

  // Create campaign
  fastify.post('/', {
    preHandler: [validateBody(createCampaignSchema)],
  }, async (request, reply) => {
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
        username,
        first_name,
        last_name,
      } = request.body as any;

      const user = await UserModel.findOrCreate({
        telegram_id,
        username,
        first_name,
        last_name,
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

      return campaign;
    } catch (error: any) {
      reply.code(500).send({ error: error.message });
    }
  });

  // Update campaign
  fastify.put('/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const {
        title,
        description,
        budget_ton,
        target_subscribers_min,
        target_subscribers_max,
        status,
      } = request.body as any;

      const campaign = await CampaignRepository.update(parseInt(id), {
        title,
        description,
        budget_ton: budget_ton ? parseFloat(budget_ton) : undefined,
        target_subscribers_min: target_subscribers_min ? parseInt(target_subscribers_min) : undefined,
        target_subscribers_max: target_subscribers_max ? parseInt(target_subscribers_max) : undefined,
        status,
      });

      return campaign;
    } catch (error: any) {
      reply.code(500).send({ error: error.message });
    }
  });
};

export default campaignsRouter;
