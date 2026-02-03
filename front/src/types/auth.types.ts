import type { User } from "./user.types"

export type Auth = {
  access_token: string
  expires_in: number
}

export interface LoginResponse {
  accessToken: string
  user: User
}

export interface TelegramWidgetUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  photo_url?: string
  language_code?: string
  is_premium?: boolean
  auth_date: number
  hash: string
}
