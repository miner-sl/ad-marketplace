export interface User {
  id: number;
  telegram_id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  photo_url?: string;
  language_code?: string;
  is_premium?: boolean;
  wallet_address?: string;
  is_channel_owner: boolean;
  is_advertiser: boolean;
  created_at: Date;
  updated_at: Date;
}
