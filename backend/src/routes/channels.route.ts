import { FastifyPluginAsync } from 'fastify';
import { validateBody, validateQuery } from '../middleware/validation';
import { authMiddleware } from '../middleware/auth';
import { createChannelSchema, listChannelsQuerySchema, setChannelPricingSchema, updateChannelStatusSchema } from '../utils/validation';
import { ChannelsController } from '../controllers/channels.controller';

const channelsRouter: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', {
    preHandler: [authMiddleware, validateQuery(listChannelsQuerySchema)],
  }, ChannelsController.getChannelsByFilters);

  fastify.get('/:id', ChannelsController.getChannelById);

  fastify.post('/', {
    preHandler: [authMiddleware, validateBody(createChannelSchema)],
  }, ChannelsController.registerChannel);

  fastify.post('/:id/pricing', {
    preHandler: [authMiddleware, validateBody(setChannelPricingSchema)],
  }, ChannelsController.setChannelPricing);

  fastify.patch('/:id/status', {
    preHandler: [authMiddleware, validateBody(updateChannelStatusSchema)],
  }, ChannelsController.updateChannelStatus);

  fastify.post('/:id/refresh-stats', ChannelsController.refreshChannelStats);

  fastify.get('/topics', ChannelsController.getAllTopics);

  fastify.get('/topics/:id', ChannelsController.getTopicById);
};

export default channelsRouter;
