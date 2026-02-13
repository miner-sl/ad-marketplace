import { FastifyPluginAsync } from 'fastify';
import { validateQuery, validateBody } from '../middleware/validation';
import { authMiddleware } from '../middleware/auth';
import { z } from 'zod';
import { UserController } from '../controllers/user.controller';
import { updateWalletAddressSchema } from '../utils/validation';

const getUserMeQuerySchema = z.object({
  telegram_id: z.string().regex(/^\d+$/).transform(Number),
});

const userRouter: FastifyPluginAsync = async (fastify) => {
  fastify.get('/me', {
    preHandler: [validateQuery(getUserMeQuerySchema)],
  }, UserController.getCurrentUser);

  fastify.get('/transactions', {
    preHandler: [authMiddleware],
  }, UserController.getTransactions);

  fastify.get('/transactions/analytics', {
    preHandler: [authMiddleware],
  }, UserController.getTransactionAnalytics);

  fastify.post('/register', UserController.registerUser);

  fastify.post('/update-wallet-address', {
    preHandler: [authMiddleware, validateBody(updateWalletAddressSchema)],
  }, UserController.updateWalletAddress);
};

export default userRouter;
