import { FastifyPluginAsync } from 'fastify';
import { authMiddleware } from '../middleware/auth';
import { AuthController } from '../controllers/auth.controller';

const authRouter: FastifyPluginAsync = async (fastify) => {
  fastify.post('/telegram/widget', AuthController.loginWithTelegramWidget);

  fastify.post('/telegram/webapp', AuthController.loginWithTelegramWebApp);

  fastify.post('/logout', {
    preHandler: [authMiddleware],
  }, AuthController.logout);

  fastify.get('/me', {
    preHandler: [authMiddleware],
  }, AuthController.getCurrentUser);
};

export default authRouter;
