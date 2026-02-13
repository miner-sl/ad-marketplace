import { FastifyPluginAsync } from 'fastify';
import { validateBody, validateQuery } from '../middleware/validation';
import { authMiddleware } from '../middleware/auth';
import { createChannelSchema, listChannelsQuerySchema, setChannelPricingSchema, updateChannelStatusSchema, updateChannelSchema, validateChannelSchema } from '../utils/validation';
import { ChannelsController } from '../controllers/channels.controller';

const channelsRouter: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', {
    preHandler: [authMiddleware, validateQuery(listChannelsQuerySchema)],
  }, ChannelsController.getChannelsByFilters);

  fastify.get('/:id', {
    preHandler: [authMiddleware],
  }, ChannelsController.getChannelById);

  fastify.post('/', {
    preHandler: [authMiddleware, validateBody(createChannelSchema)],
  }, ChannelsController.registerChannel);

  fastify.post('/:id/pricing', {
    preHandler: [authMiddleware, validateBody(setChannelPricingSchema)],
  }, ChannelsController.setChannelPricing);

  fastify.patch('/:id/status', {
    preHandler: [authMiddleware, validateBody(updateChannelStatusSchema)],
  }, ChannelsController.updateChannelStatus);

  fastify.post('/:id/update', {
    preHandler: [authMiddleware, validateBody(updateChannelSchema)],
  }, ChannelsController.updateChannel);

  fastify.post('/validate', {
    preHandler: [authMiddleware, validateBody(validateChannelSchema)],
  }, ChannelsController.validateChannel);

  fastify.get('/topics', ChannelsController.getAllTopics);
};

export default channelsRouter;
