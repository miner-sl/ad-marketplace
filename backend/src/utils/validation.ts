import { z } from 'zod';

export const createChannelSchema = z.object({
  telegram_channel_id: z.number(),
  username: z.string().optional(),
  topic_id: z.number().int().positive().optional(),
});

export const createDealSchema = z.object({
  pricing_id: z.number().positive(),
  advertiser_id: z.number(),
  publish_date: z.string().datetime().optional(),
  postText: z.string().optional(),
});

export const createCampaignSchema = z.object({
  telegram_id: z.number(),
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  budget_ton: z.number().positive().optional(),
  target_subscribers_min: z.number().int().positive().optional(),
  target_subscribers_max: z.number().int().positive().optional(),
  target_views_min: z.number().int().positive().optional(),
  target_languages: z.array(z.string()).optional(),
  preferred_formats: z.array(z.string()).optional(),
});

export const submitCreativeSchema = z.object({
  channel_owner_id: z.number(),
  content_type: z.string(),
  content_data: z.record(z.any()),
});

export const confirmPaymentSchema = z.object({
  tx_hash: z.string().min(1),
});

export const listDealsQuerySchema = z.object({
  user_id: z.string().regex(/^\d+$/).optional(),
  status: z.enum([
    'pending',
    'negotiating',
    'approved',
    'payment_pending',
    'paid',
    'creative_submitted',
    'creative_approved',
    'scheduled',
    'posted',
    'verified',
    'completed',
    'cancelled',
    'refunded',
  ]).optional(),
  deal_type: z.enum(['listing', 'campaign']).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
});

export const dealRequestsQuerySchema = z.object({
  telegram_id: z.string().regex(/^\d+$/).transform(Number),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
});
