import { FastifyRequest, FastifyReply } from 'fastify';

import {DealFlowService, SubmitPaymentDto} from '../services/deal-flow.service';
import { ChannelModel } from '../repositories/channel-model.repository';

import logger from '../utils/logger';
import {authService} from "../services/auth.service";

export class DealsController {
  static async listDeals(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { user_id, status, deal_type, limit } = request.query as any;

      const result = await DealFlowService.findDeals(Number(user_id), status, deal_type, Number(limit));
      if (!result.ok) {
        return reply.code(404).send({ error: result.error });
      }
      return result.data;
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
      const {
        telegram_id,
        channel: channelId,
        limit: limitValue,
        page: pageValue,
        date_from: dateFrom,
        date_to: dateTo,
        country,
        locale,
        premium_only: premiumOnly = false,
      } = request.query as any;
      const dealsLimit = limitValue ?? 20;
      const page = pageValue != null ? Math.max(1, parseInt(String(pageValue), 10) || 1) : 1;

      const result = await DealFlowService.findDealRequestByTelegramId(telegram_id, {
        limit: dealsLimit,
        page,
        channelId: channelId != null ? Number(channelId) : undefined,
        dateFrom: dateFrom ?? undefined,
        dateTo: dateTo ?? undefined,
        country: country ?? undefined,
        locale: locale ?? undefined,
        premiumOnly: premiumOnly === 'true' || premiumOnly === true,
      });
      return result;
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
      const { user_id } = request.query as any;

      const telegramUserId = user_id
        ? (typeof user_id === 'string' ? Number(user_id) : user_id)
        : undefined;

      const deal = await DealFlowService.getDealById(parseInt(id), telegramUserId);

      return reply.send(deal);
    } catch (error: any) {
      logger.error('Failed to get deal', {
        error: error.message,
        stack: error.stack,
        dealId: (request.params as { id: string }).id,
      });

      if (error.message === 'Deal not found') {
        return reply.code(404).send({ error: error.message });
      }

      reply.code(500).send({ error: error.message });
    }
  }

  static async createDeal(request: FastifyRequest, reply: FastifyReply) {
    try {
      const {
        pricing_id,
        publish_date,
        postText,
      } = request.body as any;
      const userId = request?.user?.id;
      if (!userId) {
        return reply.code(400).send({
          error: 'Invalid user',
          message: 'Telegram ID not found in token',
        });
      }
      if (!pricing_id) {
        return reply.code(400).send({ error: 'pricing_id is required' });
      }

      const result = await DealFlowService.initializeDeal({
        deal_type: 'listing',
        pricing_id,
        advertiser_id: userId,
        publish_date: publish_date ? new Date(publish_date) : undefined,
        postText,
      });

      return reply.send(result);
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
      const userId = request.user?.telegramId as number;

      const deal = await DealFlowService.acceptDealWithNotify(parseInt(id), userId);

      return reply.send(deal);
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
      return reply.send(deal);
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
      return reply.send(creative);
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
      return reply.send(deal);
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
      const { notes } = request.body as { notes: string };
      const deal = await DealFlowService.requestRevision(
        parseInt(id),
        userId,
        notes
      );
      return reply.send(deal);
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
      return reply.send(result);
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

      const deal = await DealFlowService.declineDealWithNotification(Number(id), userId, reason);
      return reply.send(deal);
    } catch (error: any) {
      logger.error('Failed to decline deal', {
        error: error.message,
        stack: error.stack,
        dealId: (request.params as { id: string }).id,
      });
      reply.code(500).send({ error: error.message });
    }
  }

  static async submitPayment(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = request.user?.id;
      if (!userId) {
        return reply.code(401).send({
          status: "failed",
          error: "Unauthorized",
        });
      }

      const { dealId } = request.params as { dealId: string };
      const dealIdNum = parseInt(dealId);

      if (!dealIdNum || isNaN(dealIdNum)) {
        return reply.code(400).send({
          status: "failed",
          error: "Valid deal ID is required",
        });
      }

      const { wallet, boc } = request.body as { wallet?: string; boc?: string };

      const dto: SubmitPaymentDto = {
        dealId: dealIdNum,
        userId,
        wallet,
        boc,
      };

      const result = await DealFlowService.submitPayment(dto);

      return reply.send({
        status: "success",
        result,
      });
    } catch (error: any) {
      logger.error('Failed to submit payment', {
        error: error.message,
        stack: error.stack,
        userId: request.user?.id,
        dealId: (request.params as { dealId: string })?.dealId,
      });

      if (error.message === 'Deal not found') {
        return reply.code(404).send({
          status: "failed",
          error: error.message,
        });
      }

      if (error.message.includes('payment_pending') || error.message.includes('advertiser')) {
        return reply.code(400).send({
          status: "failed",
          error: error.message,
        });
      }

      if (error.message.includes('Only the advertiser')) {
        return reply.code(403).send({
          status: "failed",
          error: error.message,
        });
      }

      return reply.code(500).send({
        status: "failed",
        error: "Internal server error",
      });
    }
  }
}
