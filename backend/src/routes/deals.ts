import { FastifyPluginAsync } from 'fastify';
import { DealModel } from '../models/Deal';
import { DealRepository } from '../repositories/DealRepository';
import { CreativeRepository } from '../repositories/CreativeRepository';
import { DealFlowService } from '../services/dealFlow';
import { UserModel } from '../models/User';
import { ChannelModel } from '../models/Channel';
import { validateBody, validateQuery } from '../middleware/validation';
import { createDealSchema, confirmPaymentSchema, submitCreativeSchema, listDealsQuerySchema, dealRequestsQuerySchema } from '../utils/validation';

const dealsRouter: FastifyPluginAsync = async (fastify) => {
  // List deals
  fastify.get('/', {
    preHandler: [validateQuery(listDealsQuerySchema)],
  }, async (request, reply) => {
    try {
      const { user_id, status, deal_type, limit } = request.query as any;
      let deals;

      if (user_id) {
        const telegramId = user_id as string;
        const user = await UserModel.findByTelegramId(Number(telegramId));
        if (!user) {
          return reply.code(404).send({ error: 'User not found' });
        }
        deals = await DealModel.findByUser(user.id, status as string | undefined);
      } else {
        deals = await DealRepository.listDealsWithFilters({
          status: status as string | undefined,
          deal_type: deal_type as string | undefined,
          limit: (limit as unknown as number) || 20,
        });
      }

      return deals;
    } catch (error: any) {
      reply.code(500).send({ error: error.message });
    }
  });

  // Get deal requests for channel owner by Telegram ID
  fastify.get('/requests', {
    preHandler: [validateQuery(dealRequestsQuerySchema)],
  }, async (request, reply) => {
    try {
      const { telegram_id, limit: limitValue } = request.query as any;
      const dealsLimit = limitValue ?? 20;

      const deals = await DealFlowService.findDealRequestByTelegramId(telegram_id, dealsLimit);
      return deals;
    } catch (error: any) {
      if (error.message === 'User not found') {
        return reply.code(404).send({ error: error.message });
      }
      reply.code(500).send({ error: error.message });
    }
  });

  // Get deal details
  fastify.get('/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const deal = await DealModel.findByIdWithChannel(parseInt(id));
      if (!deal) {
        return reply.code(404).send({ error: 'Deal not found' });
      }

      let user = null;
      const { user_id } = request.query as any;
      if (user_id) {
        const telegramIdStr = typeof user_id === 'string' ? user_id : String(user_id);
        const telegramId = Number(telegramIdStr);
        if (!isNaN(telegramId)) {
          user = await UserModel.findByTelegramId(telegramId);
          // if (user) {
            // console.log(deal, user.id);
            // const isAuthorized =
            //   deal.channel_owner_id === user.id ||
            //   deal.advertiser_id === user.id;

            // if (!isAuthorized) {
            //   return reply.code(403).send({ error: 'Unauthorized: You are not authorized to view this deal' });
            // }
          // }
        }
      }

      const messages = await DealRepository.getMessages(deal.id);
      const creative = await CreativeRepository.findByDeal(deal.id);

      const advertiser = await UserModel.findById(deal.advertiser_id);
      const advertiserInfo = advertiser ? {
        id: advertiser.id,
        telegram_id: Number(advertiser.telegram_id),
        username: advertiser.username,
        first_name: advertiser.first_name,
        last_name: advertiser.last_name,
        is_channel_owner: advertiser.is_channel_owner,
        is_advertiser: advertiser.is_advertiser,
      } : null;

      // TODO: Remove sensitive fields before sending the response
      // TODO: Select only the required fields in the SQL query
      const { channel_owner_wallet_address, ...dealWithoutWallet } = deal;

      return {
        ...dealWithoutWallet,
        owner: user !== null ? user?.id === deal.channel_owner_id : false,
        advertiser: advertiserInfo,
        messages,
        creative,
      };
    } catch (error: any) {
      reply.code(500).send({ error: error.message });
    }
  });

  // Create deal
  fastify.post('/', {
    preHandler: [validateBody(createDealSchema)],
  }, async (request, reply) => {
    try {
      const {
        pricing_id,
        advertiser_id,
        publish_date,
        postText,
      } = request.body as any;

      if (!pricing_id) {
        return reply.code(400).send({ error: 'pricing_id is required' });
      }

      // Fetch pricing details and derive other fields
      const pricing = await ChannelModel.getPricingById(pricing_id);
      if (!pricing) {
        return reply.code(404).send({ error: 'Pricing not found' });
      }

      const result = await DealFlowService.initializeDeal({
        deal_type: 'listing',
        channel_id: pricing.channel_id,
        channel_owner_id: pricing.owner_id,
        advertiser_id,
        ad_format: pricing.ad_format,
        price_ton: pricing.price_ton,
        publish_date: publish_date ? new Date(publish_date) : undefined,
        postText,
      });

      return result;
    } catch (error: any) {
      reply.code(500).send({ error: error.message });
    }
  });

  // Accept deal
  fastify.post('/:id/accept', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { channel_owner_id } = request.body as any;
      const deal = await DealFlowService.acceptDeal(parseInt(id), channel_owner_id);
      return deal;
    } catch (error: any) {
      reply.code(500).send({ error: error.message });
    }
  });

  // Confirm payment
  fastify.post('/:id/payment', {
    preHandler: [validateBody(confirmPaymentSchema)],
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { tx_hash } = request.body as any;
      const deal = await DealFlowService.confirmPayment(parseInt(id), tx_hash);
      return deal;
    } catch (error: any) {
      reply.code(500).send({ error: error.message });
    }
  });

  // Submit creative
  fastify.post('/:id/creative', {
    preHandler: [validateBody(submitCreativeSchema)],
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { channel_owner_id, content_type, content_data } = request.body as any;
      const creative = await DealFlowService.submitCreative(
        parseInt(id),
        channel_owner_id,
        { contentType: content_type, contentData: content_data }
      );
      return creative;
    } catch (error: any) {
      reply.code(500).send({ error: error.message });
    }
  });

  // Approve creative
  fastify.post('/:id/creative/approve', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { advertiser_id } = request.body as any;
      const deal = await DealFlowService.approveCreative(parseInt(id), advertiser_id);
      return deal;
    } catch (error: any) {
      reply.code(500).send({ error: error.message });
    }
  });

  // Request revision
  fastify.post('/:id/creative/revision', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { advertiser_id, notes } = request.body as any;
      const deal = await DealFlowService.requestRevision(
        parseInt(id),
        advertiser_id,
        notes
      );
      return deal;
    } catch (error: any) {
      reply.code(500).send({ error: error.message });
    }
  });

  // Schedule post
  fastify.post('/:id/schedule', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { post_time } = request.body as any;
      const deal = await DealFlowService.schedulePost(
        parseInt(id),
        new Date(post_time)
      );
      return deal;
    } catch (error: any) {
      reply.code(500).send({ error: error.message });
    }
  });

  // Cancel deal
  fastify.post('/:id/cancel', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const deal = await DealModel.cancel(parseInt(id));
      return deal;
    } catch (error: any) {
      reply.code(500).send({ error: error.message });
    }
  });
};

export default dealsRouter;
