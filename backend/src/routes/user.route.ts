import { FastifyPluginAsync } from 'fastify';
import { validateQuery } from '../middleware/validation';
import { z } from 'zod';
import { UserController } from '../controllers/user.controller';

const getUserMeQuerySchema = z.object({
  telegram_id: z.string().regex(/^\d+$/).transform(Number),
});

const userRouter: FastifyPluginAsync = async (fastify) => {
  fastify.get('/me', {
    preHandler: [validateQuery(getUserMeQuerySchema)],
  }, UserController.getCurrentUser);

  // Register/update user
  fastify.post('/register', UserController.registerUser);
};

export default userRouter;
