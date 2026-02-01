export type UserRole = 'channel_owner' | 'advertiser'

export type User = {
  id: number
  telegram_id: number
  username?: string
  first_name?: string
  last_name?: string
  is_channel_owner: boolean
  is_advertiser: boolean
  created_at: string
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
