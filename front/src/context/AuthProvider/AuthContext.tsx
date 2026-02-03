import { createContext } from 'react'
import type { User, TelegramWidgetUser } from '@types'

export interface AuthContextType {
  user: User | null
  loading: boolean
  isTelegramMiniApp: boolean
  loginWithTelegramWidget: (telegramUser: TelegramWidgetUser) => Promise<void>
  loginWithTelegramMiniApp: (initData: string) => Promise<void>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined)
