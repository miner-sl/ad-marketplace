import { FastifyPluginAsync } from 'fastify';
import { validateBody } from '../middleware/validation';
import { authMiddleware } from '../middleware/auth';
import { createCampaignSchema } from '../utils/validation';
import { CampaignsController } from '../controllers/campaigns.controller';

const campaignsRouter: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', {
    preHandler: [authMiddleware],
  }, CampaignsController.listCampaigns);

  fastify.get('/:id', {
    preHandler: [authMiddleware],
  }, CampaignsController.getCampaignById);

  fastify.post('/', {
    preHandler: [authMiddleware, validateBody(createCampaignSchema)],
  }, CampaignsController.createCampaign);

  fastify.put('/:id', {
    preHandler: [authMiddleware],
  }, CampaignsController.updateCampaign);
};

export default campaignsRouter;
