import { FastifyPluginAsync } from 'fastify';
import { validateBody } from '../middleware/validation';
import { createCampaignSchema } from '../utils/validation';
import { CampaignsController } from '../controllers/campaigns.controller';

const campaignsRouter: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', CampaignsController.listCampaigns);

  fastify.get('/:id', CampaignsController.getCampaignById);

  fastify.post('/', {
    preHandler: [validateBody(createCampaignSchema)],
  }, CampaignsController.createCampaign);

  fastify.put('/:id', CampaignsController.updateCampaign);
};

export default campaignsRouter;
