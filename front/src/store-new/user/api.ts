import { MarketplaceService } from '@services'
import type { User, RegisterUserRequest } from '@types'

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
}
