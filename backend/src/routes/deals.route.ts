import { FastifyPluginAsync } from 'fastify';
import { validateBody, validateQuery } from '../middleware/validation';
import { authMiddleware } from '../middleware/auth';
import { createDealSchema, confirmPaymentSchema, submitCreativeSchema, listDealsQuerySchema, dealRequestsQuerySchema, declineDealSchema, submitPaymentSchema } from '../utils/validation';
import { DealsController } from '../controllers/deals.controller';

const dealsRouter: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', {
    preHandler: [validateQuery(listDealsQuerySchema)],
  }, DealsController.listDeals);

  fastify.get('/requests', {
    preHandler: [authMiddleware, validateQuery(dealRequestsQuerySchema)],
  }, DealsController.getDealRequests);

  fastify.get('/:id', {
    preHandler: [authMiddleware],
  }, DealsController.getDealById);

  fastify.post('/', {
    preHandler: [authMiddleware, validateBody(createDealSchema)],
  }, DealsController.createDeal);

  fastify.post('/:id/accept', {
    preHandler: [authMiddleware],
  }, DealsController.acceptDeal);

  fastify.post('/:id/payment', {
    preHandler: [authMiddleware, validateBody(confirmPaymentSchema)],
  }, DealsController.confirmPayment);

  fastify.post('/:id/creative', {
    preHandler: [authMiddleware, validateBody(submitCreativeSchema)],
  }, DealsController.submitCreative);

  fastify.post('/:id/creative/approve', {
    preHandler: [authMiddleware],
  }, DealsController.approveCreative);

  fastify.post('/:id/creative/revision', {
    preHandler: [authMiddleware],
  }, DealsController.requestRevision);

  fastify.post('/:id/update-message', {
    preHandler: [authMiddleware],
  }, DealsController.updateDealMessage);

  fastify.post('/:id/decline', {
    preHandler: [authMiddleware, validateBody(declineDealSchema)],
  }, DealsController.declineDeal);

  fastify.post('/:dealId/pay', {
    preHandler: [authMiddleware, validateBody(submitPaymentSchema)],
  }, DealsController.submitPayment);
};

export default dealsRouter;
