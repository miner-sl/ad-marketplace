import { z } from 'zod';

const localesSchema = z.enum(['en', 'ru', 'es', 'it'])

export type Locales = z.infer<typeof localesSchema>

export const createChannelSchema = z.object({
  username: z.string().min(1).refine((val) => val.startsWith('@') || !val.includes(' '), {
    message: 'Username must start with @ or be a valid Telegram username',
  }),
  price_ton: z.number().positive(),
  topic_id: z.number().int().positive().optional(),
  country: z.string().optional(),
  locale: localesSchema.optional(),
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

export const requestRevisionSchema = z.object({
  notes: z.string().min(4),
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
    'declined',
    'refunded',
  ]).optional(),
  deal_type: z.enum(['listing', 'campaign']).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
});

export const dealRequestsQuerySchema = z.object({
  telegram_id: z.string().regex(/^\d+$/).transform(Number),
  channel: z.string().regex(/^\d+$/).transform(Number).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
  page: z.string().regex(/^\d+$/).transform(Number).optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  country: z.string().optional(),
  locale: z.string().optional(),
  premium_only: z
    .union([z.literal('true'), z.literal('false'), z.boolean()])
    .optional()
    .transform((v) => (v == null ? undefined : v === true || v === 'true')),
});

export const listChannelsQuerySchema = z.object({
  min_subscribers: z.preprocess(
    (val) => (typeof val === 'string' ? parseInt(val, 10) : val),
    z.number().int().positive().optional()
  ),
  max_subscribers: z.preprocess(
    (val) => (typeof val === 'string' ? parseInt(val, 10) : val),
    z.number().int().positive().optional()
  ),
  min_price: z.preprocess(
    (val) => (typeof val === 'string' ? parseFloat(val) : val),
    z.number().positive().optional()
  ),
  max_price: z.preprocess(
    (val) => (typeof val === 'string' ? parseFloat(val) : val),
    z.number().positive().optional()
  ),
  ad_format: z.enum(['post', 'story', 'forward']).optional(),
  search: z.string().optional(),
  topic_id: z.preprocess(
    (val) => (typeof val === 'string' ? parseInt(val, 10) : val),
    z.number().positive().optional()
  ),
  country: z.string().optional(),
  locale: z.string().optional(),
  ownerTelegramId: z.preprocess(
    (val) => {
      if (typeof val === 'string') {
        return val === 'true';
      }
      return val;
    },
    z.boolean().optional()
  ),
  status: z.enum(['active', 'inactive', 'moderation']).optional(),
  limit: z.preprocess(
    (val) => (typeof val === 'string' ? parseInt(val, 10) : val ?? 50),
    z.number().int().positive().default(50)
  ),
  offset: z.preprocess(
    (val) => (typeof val === 'string' ? parseInt(val, 10) : val ?? 0),
    z.number().int().nonnegative().default(0)
  ),
});

export const setChannelPricingSchema = z.object({
  ad_format: z.enum(['post', 'story', 'forward']),
  price_ton: z.number().positive(),
  is_active: z.boolean().optional().default(true),
});

export const updateChannelStatusSchema = z.object({
  is_active: z.boolean(),
});

export const updateChannelSchema = z.object({
  active: z.boolean().optional(),
  price: z.number().positive().optional(),
  topic: z.number().int().positive().optional().nullable(),
  country: z.string().optional().nullable(),
  locale: localesSchema.optional().nullable(),
});

export const updateWalletAddressSchema = z.object({
  wallet_address: z.string().min(1),
});

export const declineDealSchema = z.object({
  dealId: z.number().int().positive(),
  reason: z.string().optional(),
});

export const submitPaymentSchema = z.preprocess(
  (data: any) => {
    return data;
  },
  z.object({
    // description: z.string().min(1).max(512),
    wallet: z.string().optional(),
    boc: z.string().optional(),
  }),
);

export const validateChannelSchema = z.object({
  channelName: z.string().min(1),
});
