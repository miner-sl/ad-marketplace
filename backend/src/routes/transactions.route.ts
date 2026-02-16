import {FastifyPluginAsync} from 'fastify';
import {authMiddleware} from '../middleware/auth';
import {validateQuery} from '../middleware/validation';
import {listChannelsQuerySchema} from '../utils/validation';
import {TransactionController} from '../controllers/transaction.controller';

const transactionsRouter: FastifyPluginAsync = async (fastify) => {
  fastify.get('/payload/create', {
    preHandler: [authMiddleware, validateQuery(listChannelsQuerySchema)],
  }, TransactionController.routeGETContestTonProofPayloadCreate);

  fastify.post(
    '/deal/:dealId/create',
    {
      preHandler: [authMiddleware],
    },
    TransactionController.createContestTransaction
  );
};

export default transactionsRouter;
