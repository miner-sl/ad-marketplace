import { FastifyRequest, FastifyReply } from 'fastify';
import { CampaignRepository } from '../repositories/campaign.repository';
import { UserModel } from '../repositories/user.repository';
import logger from '../utils/logger';

export class CampaignsController {
  static async listCampaigns(request: FastifyRequest, reply: FastifyReply) {
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
      logger.error('Failed to list campaigns', {
        error: error.message,
        stack: error.stack,
      });
      reply.code(500).send({ error: error.message });
    }
  }

  static async getCampaignById(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const campaign = await CampaignRepository.findById(parseInt(id));
      if (!campaign) {
        return reply.code(404).send({ error: 'Campaign not found' });
      }
      return campaign;
    } catch (error: any) {
      logger.error('Failed to get campaign', {
        error: error.message,
        stack: error.stack,
        campaignId: (request.params as { id: string }).id,
      });
      reply.code(500).send({ error: error.message });
    }
  }

  static async createCampaign(request: FastifyRequest, reply: FastifyReply) {
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
      logger.error('Failed to create campaign', {
        error: error.message,
        stack: error.stack,
      });
      reply.code(500).send({ error: error.message });
    }
  }

  static async updateCampaign(request: FastifyRequest, reply: FastifyReply) {
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
      logger.error('Failed to update campaign', {
        error: error.message,
        stack: error.stack,
        campaignId: (request.params as { id: string }).id,
      });
      reply.code(500).send({ error: error.message });
    }
  }
}
