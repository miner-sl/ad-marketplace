import { FastifyRequest, FastifyReply } from 'fastify';
import { CampaignRepository } from '../repositories/campaign.repository';
import { CampaignsService, CreateCampaignDto } from '../services/campaigns.service';
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
      const body = request.body as any;

      const dto: CreateCampaignDto = {
        telegram_id: body.telegram_id,
        title: body.title,
        description: body.description,
        budget_ton: body.budget_ton ? parseFloat(body.budget_ton) : undefined,
        target_subscribers_min: body.target_subscribers_min ? parseInt(body.target_subscribers_min) : undefined,
        target_subscribers_max: body.target_subscribers_max ? parseInt(body.target_subscribers_max) : undefined,
        target_views_min: body.target_views_min ? parseInt(body.target_views_min) : undefined,
        target_languages: body.target_languages,
        preferred_formats: body.preferred_formats,
        username: body.username,
        first_name: body.first_name,
        last_name: body.last_name,
      };

      const campaign = await CampaignsService.createCampaign(dto);
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
