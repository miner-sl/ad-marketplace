export type DealStatus =
  | 'pending'
  | 'negotiating'
  | 'approved'
  | 'payment_pending'
  | 'paid'
  | 'creative_submitted'
  | 'creative_approved'
  | 'scheduled'
  | 'posted'
  | 'verified'
  | 'completed'
  | 'cancelled'
  | 'refunded';

export type DealType = 'listing' | 'campaign';

export interface Deal {
  id: number;
  deal_type: DealType;
  listing_id?: number;
  campaign_id?: number;
  channel_id: number;
  channel_owner_id: number;
  advertiser_id: number;
  ad_format: string;
  price_ton: number;
  status: DealStatus;
  escrow_address?: string;
  channel_owner_wallet_address?: string;
  payment_tx_hash?: string;
  payment_confirmed_at?: Date;
  scheduled_post_time?: Date;
  actual_post_time?: Date;
  post_message_id?: number;
  post_verification_until?: Date;
  first_publication_time?: Date;
  min_publication_duration_days?: number;
  timeout_at?: Date;
  created_at: Date;
  updated_at: Date;
}
