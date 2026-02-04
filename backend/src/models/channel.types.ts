export interface Channel {
  id: number;
  owner_id: number;
  telegram_channel_id: number;
  username?: string;
  title?: string;
  description?: string;
  topic_id?: number;
  bot_admin_id?: number;
  is_verified: boolean;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Topic {
  id: number;
  name: string;
  description?: string;
  created_at: Date;
  updated_at: Date;
}

export interface ChannelStats {
  id: number;
  channel_id: number;
  subscribers_count?: number;
  average_views?: number;
  average_reach?: number;
  language_distribution?: Record<string, number>;
  premium_subscribers_count?: number;
  stats_date: Date;
  created_at: Date;
}

export interface ChannelPricing {
  id: number;
  channel_id: number;
  ad_format: string;
  price_ton: number;
  currency: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}
