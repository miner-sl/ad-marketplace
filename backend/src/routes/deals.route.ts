import { FastifyPluginAsync } from 'fastify';
import { validateBody, validateQuery } from '../middleware/validation';
import { createDealSchema, confirmPaymentSchema, submitCreativeSchema, listDealsQuerySchema, dealRequestsQuerySchema } from '../utils/validation';
import { DealsController } from '../controllers/deals.controller';

const dealsRouter: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', {
    preHandler: [validateQuery(listDealsQuerySchema)],
  }, DealsController.listDeals);

  fastify.get('/requests', {
    preHandler: [validateQuery(dealRequestsQuerySchema)],
  }, DealsController.getDealRequests);

  fastify.get('/:id', DealsController.getDealById);

  fastify.post('/', {
    preHandler: [validateBody(createDealSchema)],
  }, DealsController.createDeal);

  fastify.post('/:id/accept', DealsController.acceptDeal);

  fastify.post('/:id/payment', {
    preHandler: [validateBody(confirmPaymentSchema)],
  }, DealsController.confirmPayment);

  fastify.post('/:id/creative', {
    preHandler: [validateBody(submitCreativeSchema)],
  }, DealsController.submitCreative);

  fastify.post('/:id/creative/approve', DealsController.approveCreative);

  fastify.post('/:id/creative/revision', DealsController.requestRevision);

  fastify.post('/:id/schedule', DealsController.schedulePost);

  fastify.post('/:id/cancel', DealsController.cancelDeal);
};

export default dealsRouter;
