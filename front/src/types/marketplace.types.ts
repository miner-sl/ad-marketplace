export type DealStatus =
  | 'pending'
  | 'negotiating'
  | 'approved'
  | 'payment_pending'
  | 'paid'
  // | 'creative_submitted'
  // | 'creative_approved'
  | 'scheduled'
  | 'posted'
  | 'verified'
  | 'completed'
  | 'declined'
  | 'refunded'

export type DealType = 'listing' | 'campaign'

export type AdFormat = 'post' | 'forward' | 'story'

export interface ChannelStats {
  id: number
  channel_id: number
  subscribers_count?: number
  average_views?: number
  average_reach?: number
  language_distribution?: Record<string, number>
  premium_subscribers_count?: number
  stats_date: string
  created_at: string
}

export interface ChannelPricing {
  id: number
  channel_id: number
  ad_format: AdFormat
  price_ton: number
  currency: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Channel {
  id: number
  owner_id: number
  telegram_channel_id: number
  username?: string
  title?: string
  price_ton?: string
  description?: string
  bot_admin_id?: number
  is_verified: boolean
  is_active: boolean
  topic_id?: number
  topic?: { id: number; name: string }
  country?: string | null
  locale?: string | null
  created_at: string
  updated_at: string
  stats?: ChannelStats
  pricing?: ChannelPricing[]
}

export interface ChannelListing {
  id: number
  channel_id: number
  title?: string
  description?: string
  is_active: boolean
  created_at: string
  updated_at: string
  channel?: Channel
}

export interface Campaign {
  id: number
  advertiser_id: number
  title: string
  description?: string
  budget_ton?: number
  target_subscribers_min?: number
  target_subscribers_max?: number
  target_views_min?: number
  target_languages?: string[]
  preferred_formats?: AdFormat[]
  status: 'draft' | 'active' | 'closed' | 'completed'
  created_at: string
  updated_at: string
}

export interface DealMessage {
  id: number
  deal_id: number
  sender_id: number
  message_text: string
  created_at: string
}

export interface AdvertiserInfo {
  id: number
  telegram_id: number
  username?: string
  first_name?: string
  last_name?: string
  is_channel_owner: boolean
  is_advertiser: boolean
}

export interface Deal {
  id: number
  deal_type: DealType
  listing_id?: number
  campaign_id?: number
  channel_id: number
  channel_owner_id: number
  advertiser_id: number
  ad_format: AdFormat
  owner: boolean
  advertiser: boolean | AdvertiserInfo | null
  price_ton: number
  status: DealStatus
  escrow_address?: string
  channel_owner_wallet_address?: string
  payment_tx_hash?: string
  payment_confirmed_at?: string
  scheduled_post_time?: string
  actual_post_time?: string
  post_message_id?: number
  post_verification_until?: string
  first_publication_time?: string
  min_publication_duration_days?: number
  decline_reason?: string
  created_at: string
  updated_at: string
  channel?: Channel
  campaign?: Campaign
  listing?: ChannelListing
  messages?: DealMessage[]
}

export interface Creative {
  id: number
  deal_id: number
  submitted_by: number
  content_type: 'text' | 'photo' | 'video' | 'document'
  content_data: Record<string, unknown>
  status: 'pending' | 'approved' | 'rejected' | 'revision_requested'
  revision_notes?: string
  created_at: string
  updated_at: string
}

export interface ChannelFilters {
  search?: string
  min_subscribers?: number
  max_subscribers?: number
  min_price?: number
  max_price?: number
  ad_format?: AdFormat
  min_views?: number
  language?: string
  topic_id?: number
  country?: string
  locale?: string
  ownerTelegramId?: boolean
  limit?: number
  offset?: number
}

export interface CampaignFilters {
  min_budget?: number
  max_budget?: number
  min_subscribers?: number
  max_subscribers?: number
  status?: Campaign['status']
  limit?: number
  offset?: number
}

export interface DealFilters {
  user_id?: number
  status?: DealStatus
  deal_type?: DealType
  limit?: number
  offset?: number
}

export interface DealRequestsFilters {
  channelId?: number
  limit?: number
  page?: number
  dateFrom?: string
  dateTo?: string
  country?: string
  locale?: string
  premiumOnly?: boolean
}

export interface DealRequestsResponse {
  data: Deal[]
  allAmount: number
  page: number
}

export interface CreateChannelListingRequest {
  channel_id: number
  title?: string
  description?: string
}

export interface CreateCampaignRequest {
  title: string
  description?: string
  budget_ton?: number
  target_subscribers_min?: number
  target_subscribers_max?: number
  target_views_min?: number
  target_languages?: string[]
  preferred_formats?: AdFormat[]
}

export interface CreateDealRequest {
  // New simplified format
  pricing_id?: number
  advertiser_id: number
  publish_date?: string
  postText?: string
  // Legacy fields (for backward compatibility)
  deal_type?: DealType
  listing_id?: number
  campaign_id?: number
  channel_id?: number
  channel_owner_id?: number
  ad_format?: AdFormat
  price_ton?: number
}

export interface SubmitCreativeRequest {
  deal_id: number
  channel_owner_id: number
  content_type: Creative['content_type']
  content_data: Record<string, unknown>
}

export interface SetChannelPricingRequest {
  channel_id: number
  ad_format: AdFormat
  price_ton: number
  is_active?: boolean
}

export interface UpdateChannelRequest {
  active?: boolean
  price?: number
  topic?: number | null
  country?: string | null
  locale?: LocaleCode | null
}

export type LocaleCode = 'en' | 'ru' | 'es' | 'it'

export interface CreateChannelRequest {
  username: string
  price_ton: number
  topic_id?: number
  country?: string
  locale?: LocaleCode
}

/** Options for country/locale selects (value + display name) */
export interface SelectOption {
  value: string
  name: string
}

/** Predefined countries for channel filters and forms */
export const COUNTRIES: SelectOption[] = [
  { value: 'Russia', name: 'Russia' },
  { value: 'USA', name: 'USA' },
  { value: 'India', name: 'India' },
  { value: 'Brazil', name: 'Brazil' },
  { value: 'France', name: 'France' },
  { value: 'Italy', name: 'Italy' },
  { value: 'Africa', name: 'Africa' },
]

/** Predefined locales for channel filters and forms (matches LocaleCode) */
export const LOCALES: SelectOption[] = [
  { value: 'en', name: 'English' },
  { value: 'ru', name: 'Russian' },
  { value: 'es', name: 'Spanish' },
  { value: 'it', name: 'Italian' },
]
