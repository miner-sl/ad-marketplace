import { FastifyRequest, FastifyReply } from 'fastify';
import { DealModel } from '../repositories/deal-model.repository';
import { DealRepository } from '../repositories/deal.repository';
import { CreativeRepository } from '../repositories/creative.repository';
import { DealFlowService } from '../services/deal-flow.service';
import { UserModel } from '../repositories/user.repository';
import { ChannelModel } from '../repositories/channel-model.repository';
import { TelegramNotificationService } from '../services/telegram-notification.service';
import logger from '../utils/logger';

export class DealsController {
  static async listDeals(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { user_id, status, deal_type, limit } = request.query as any;
      let deals;

      if (user_id) {
        const user = await UserModel.findById(Number(user_id));
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
      logger.error('Failed to list deals', {
        error: error.message,
        stack: error.stack,
      });
      reply.code(500).send({ error: error.message });
    }
  }

  static async getDealRequests(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { telegram_id, limit: limitValue } = request.query as any;
      const dealsLimit = limitValue ?? 20;

      const deals = await DealFlowService.findDealRequestByTelegramId(telegram_id, dealsLimit);
      return deals;
    } catch (error: any) {
      if (error.message === 'User not found') {
        return reply.code(404).send({ error: error.message });
      }
      logger.error('Failed to get deal requests', {
        error: error.message,
        stack: error.stack,
      });
      reply.code(500).send({ error: error.message });
    }
  }

  static async getDealById(request: FastifyRequest, reply: FastifyReply) {
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
      logger.error('Failed to get deal', {
        error: error.message,
        stack: error.stack,
        dealId: (request.params as { id: string }).id,
      });
      reply.code(500).send({ error: error.message });
    }
  }

  static async createDeal(request: FastifyRequest, reply: FastifyReply) {
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
      logger.error('Failed to create deal', {
        error: error.message,
        stack: error.stack,
      });
      reply.code(500).send({ error: error.message });
    }
  }

  static async acceptDeal(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const { channel_owner_id } = request.body as any;
      const deal = await DealFlowService.acceptDeal(parseInt(id), channel_owner_id);
      return deal;
    } catch (error: any) {
      logger.error('Failed to accept deal', {
        error: error.message,
        stack: error.stack,
        dealId: (request.params as { id: string }).id,
      });
      reply.code(500).send({ error: error.message });
    }
  }

  static async confirmPayment(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const { tx_hash } = request.body as any;
      const deal = await DealFlowService.confirmPayment(parseInt(id), tx_hash);
      return deal;
    } catch (error: any) {
      logger.error('Failed to confirm payment', {
        error: error.message,
        stack: error.stack,
        dealId: (request.params as { id: string }).id,
      });
      reply.code(500).send({ error: error.message });
    }
  }

  static async submitCreative(request: FastifyRequest, reply: FastifyReply) {
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
      logger.error('Failed to submit creative', {
        error: error.message,
        stack: error.stack,
        dealId: (request.params as { id: string }).id,
      });
      reply.code(500).send({ error: error.message });
    }
  }

  static async approveCreative(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const { advertiser_id } = request.body as any;
      const deal = await DealFlowService.approveCreative(parseInt(id), advertiser_id);
      return deal;
    } catch (error: any) {
      logger.error('Failed to approve creative', {
        error: error.message,
        stack: error.stack,
        dealId: (request.params as { id: string }).id,
      });
      reply.code(500).send({ error: error.message });
    }
  }

  static async requestRevision(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const userId = request.user?.id as number;
      const { notes } = request.body as any;
      const deal = await DealFlowService.requestRevision(
        parseInt(id),
        userId,
        notes
      );
      return deal;
    } catch (error: any) {
      logger.error('Failed to request revision', {
        error: error.message,
        stack: error.stack,
        dealId: (request.params as { id: string }).id,
      });
      reply.code(500).send({ error: error.message });
    }
  }

  static async updateDealMessage(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const userId = request.user?.id as number;
      const { message_text } = request.body as any;

      if (!userId) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      if (!message_text) {
        return reply.code(400).send({ error: 'message_text is required' });
      }

      const result = await DealFlowService.updateDealMessage(
        parseInt(id),
        userId,
        message_text
      );
      return result;
    } catch (error: any) {
      logger.error('Failed to update deal message', {
        error: error.message,
        stack: error.stack,
        dealId: (request.params as { id: string }).id,
      });
      reply.code(500).send({ error: error.message });
    }
  }

  static async schedulePost(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const { post_time } = request.body as any;
      const deal = await DealFlowService.schedulePost(
        parseInt(id),
        new Date(post_time)
      );
      return deal;
    } catch (error: any) {
      logger.error('Failed to schedule post', {
        error: error.message,
        stack: error.stack,
        dealId: (request.params as { id: string }).id,
      });
      reply.code(500).send({ error: error.message });
    }
  }

  static async declineDeal(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const userId = request.user?.id as number;
      const { dealId, reason } = request.body as any;

      if (!userId) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      if (dealId !== Number(id)) {
        return reply.code(400).send({ error: 'Deal ID in body does not match URL parameter' });
      }

      const deal = await DealFlowService.declineDeal(Number(id), userId, reason);

      try {
        const channelInfo = await DealFlowService.getChannelInfoForDeal(Number(id));
        await TelegramNotificationService.notifyDealDeclined(Number(id), deal.advertiser_id, {
          dealId: Number(id),
          channelId: channelInfo.channelId,
          channelName: channelInfo.channelName,
          priceTon: deal.price_ton,
          adFormat: deal.ad_format,
        });
      } catch (notifError: any) {
        // Log but don't fail if notification fails
        logger.warn('Failed to send decline notification', {
          error: notifError.message,
          dealId: id,
        });
      }

      return deal;
    } catch (error: any) {
      logger.error('Failed to decline deal', {
        error: error.message,
        stack: error.stack,
        dealId: (request.params as { id: string }).id,
      });
      reply.code(500).send({ error: error.message });
    }
  }
}
