import { MarketplaceService } from '@services'
import type { User, RegisterUserRequest, LedgerTransactionRow, LedgerAnalyticsByUser } from '@types'

export interface UserMeResponse {
  registered: boolean
  user: User | null
}

export const userAPI = {
  getUser: async (telegramId: number): Promise<UserMeResponse> => {
    const { data, ok, error } = await MarketplaceService.getUser(telegramId)
    if (!ok || !data) {
      throw new Error(error || 'Failed to fetch user')
    }
    return data
  },

  registerUser: async (request: RegisterUserRequest): Promise<UserMeResponse> => {
    const { data, ok, error } = await MarketplaceService.registerUser(request)
    if (!ok || !data) {
      throw new Error(error || 'Failed to register user')
    }
    return data
  },

  getTransactions: async (): Promise<LedgerTransactionRow[]> => {
    const { data, ok, error } = await MarketplaceService.getTransactions()
    if (!ok || !data) {
      throw new Error(error || 'Failed to fetch transactions')
    }
    return data
  },

  getTransactionAnalytics: async (params?: { since?: string }): Promise<LedgerAnalyticsByUser> => {
    const { data, ok, error } = await MarketplaceService.getTransactionAnalytics(params)
    if (!ok || !data) {
      throw new Error(error || 'Failed to fetch transaction analytics')
    }
    return data
  },
}
