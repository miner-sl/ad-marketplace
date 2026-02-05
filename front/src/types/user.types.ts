export type UserRole = 'channel_owner' | 'advertiser'

export type User = {
  id: number
  telegram_id?: number
  telegramId?: number
  username?: string
  first_name?: string
  is_registered?: boolean;
  firstName?: string
  last_name?: string
  lastName?: string
  is_channel_owner?: boolean
  isChannelOwner?: boolean
  is_advertiser?: boolean
  isAdvertiser?: boolean
  created_at?: string
  createdAt?: string
  photoUrl?: string
  languageCode?: string
  isPremium?: boolean
}

export interface RegisterUserRequest {
  user_id: number
  username?: string
  first_name: string
  last_name?: string
  language_code?: string
  is_premium?: boolean
  photo_url?: string
  roles: UserRole[]
}
