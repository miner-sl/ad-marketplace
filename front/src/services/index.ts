import type {
  Channel,
  ChannelFilters,
  ChannelListing,
  Campaign,
  CampaignFilters,
  Deal,
  DealFilters,
  CreateChannelListingRequest,
  CreateCampaignRequest,
  CreateDealRequest,
  SubmitCreativeRequest,
  SetChannelPricingRequest,
  ChannelPricing,
  Creative,
  RegisterUserRequest,
  User,
  LoginResponse,
  TelegramWidgetUser,
} from '@types'
import { isProd, getToken } from '@utils'

const API_BASE_URL = isProd
  ? 'https://api.example.com'
  : 'http://localhost:3000/api'

interface ApiResponse<T> {
  data: T | null
  ok: boolean
  error?: string
}

async function apiRequest<T>(
  endpoint: string,
  options?: RequestInit & { skipAuthCheck?: boolean }
): Promise<ApiResponse<T>> {
  try {
    const token = getToken()
    const headers = new Headers(options?.headers)
    headers.set('Content-Type', 'application/json')

    if (token && !options?.skipAuthCheck) {
      headers.set('Authorization', `Bearer ${token}`)
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    })

    if (!response.ok) {
      return {
        data: null,
        ok: false,
        error: `HTTP error! status: ${response.status}`,
      }
    }

    const data = await response.json()
    return {
      data,
      ok: true,
    }
  } catch (error) {
    return {
      data: null,
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

export const MarketplaceService = {
  // Channels
  getChannels: async (filters?: ChannelFilters): Promise<ApiResponse<Channel[]>> => {
    let queryParams = ''
    if (filters) {
      const params = new URLSearchParams()
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value))
        }
      })
      queryParams = params.toString() ? '?' + params.toString() : ''
    }
    return await apiRequest<Channel[]>(`/channels${queryParams}`)
  },

  getChannel: async (id: number): Promise<ApiResponse<Channel>> => {
    return await apiRequest<Channel>(`/channels/${id}`)
  },

  getChannelStats: async (id: number): Promise<ApiResponse<Channel['stats']>> => {
    return await apiRequest<Channel['stats']>(`/channels/${id}/stats`)
  },

  setChannelPricing: async (
    request: SetChannelPricingRequest
  ): Promise<ApiResponse<ChannelPricing>> => {
    return await apiRequest<ChannelPricing>(`/channels/${request.channel_id}/pricing`, {
      method: 'POST',
      body: JSON.stringify(request),
    })
  },

  updateChannelStatus: async (
    id: number,
    is_active: boolean
  ): Promise<ApiResponse<{ id: number; is_active: boolean; message: string }>> => {
    return await apiRequest<{ id: number; is_active: boolean; message: string }>(
      `/channels/${id}/status`,
      {
        method: 'PATCH',
        body: JSON.stringify({ is_active }),
      }
    )
  },

  // Channel Listings
  getChannelListings: async (filters?: {
    channel_id?: number
    is_active?: boolean
  }): Promise<ApiResponse<ChannelListing[]>> => {
    const queryParams = filters
      ? '?' + new URLSearchParams(filters as Record<string, string>).toString()
      : ''
    return await apiRequest<ChannelListing[]>(`/channel-listings${queryParams}`)
  },

  getChannelListing: async (id: number): Promise<ApiResponse<ChannelListing>> => {
    return await apiRequest<ChannelListing>(`/channel-listings/${id}`)
  },

  createChannelListing: async (
    request: CreateChannelListingRequest
  ): Promise<ApiResponse<ChannelListing>> => {
    return await apiRequest<ChannelListing>('/channel-listings', {
      method: 'POST',
      body: JSON.stringify(request),
    })
  },

  updateChannelListing: async (
    id: number,
    data: Partial<CreateChannelListingRequest> & { is_active?: boolean }
  ): Promise<ApiResponse<ChannelListing>> => {
    return await apiRequest<ChannelListing>(`/channel-listings/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },

  deleteChannelListing: async (id: number): Promise<ApiResponse<void>> => {
    return await apiRequest<void>(`/channel-listings/${id}`, {
      method: 'DELETE',
    })
  },

  // Campaigns
  getCampaigns: async (filters?: CampaignFilters): Promise<ApiResponse<Campaign[]>> => {
    const queryParams = filters
      ? '?' + new URLSearchParams(filters as Record<string, string>).toString()
      : ''
    return await apiRequest<Campaign[]>(`/campaigns${queryParams}`)
  },

  getCampaign: async (id: number): Promise<ApiResponse<Campaign>> => {
    return await apiRequest<Campaign>(`/campaigns/${id}`)
  },

  createCampaign: async (request: CreateCampaignRequest): Promise<ApiResponse<Campaign>> => {
    return await apiRequest<Campaign>('/campaigns', {
      method: 'POST',
      body: JSON.stringify(request),
    })
  },

  updateCampaign: async (
    id: number,
    data: Partial<CreateCampaignRequest> & { status?: Campaign['status'] }
  ): Promise<ApiResponse<Campaign>> => {
    return await apiRequest<Campaign>(`/campaigns/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },

  deleteCampaign: async (id: number): Promise<ApiResponse<void>> => {
    return await apiRequest<void>(`/campaigns/${id}`, {
      method: 'DELETE',
    })
  },

  // Deals
  getDeals: async (filters?: DealFilters): Promise<ApiResponse<Deal[]>> => {
    let queryParams = ''
    if (filters) {
      const params = new URLSearchParams()
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value))
        }
      })
      queryParams = params.toString() ? '?' + params.toString() : ''
    }
    console.log(`/deals${queryParams}`)
    return await apiRequest<Deal[]>(`/deals${queryParams}`)
  },

  getDeal: async (id: number, userId?: number): Promise<ApiResponse<Deal>> => {
    const queryParams = userId ? `?user_id=${userId}` : '';
    return await apiRequest<Deal>(`/deals/${id}${queryParams}`)
  },

  getDealRequests: async (telegramId: number, limit?: number): Promise<ApiResponse<Deal[]>> => {
    const queryParams = new URLSearchParams({
      telegram_id: telegramId.toString(),
    })
    if (limit) {
      queryParams.append('limit', limit.toString())
    }
    return await apiRequest<Deal[]>(`/deals/requests?${queryParams.toString()}`)
  },

  createDeal: async (request: CreateDealRequest): Promise<ApiResponse<Deal>> => {
    return await apiRequest<Deal>('/deals', {
      method: 'POST',
      body: JSON.stringify(request),
    })
  },

  acceptDeal: async (
    id: number,
    channel_owner_id: number
  ): Promise<ApiResponse<Deal>> => {
    return await apiRequest<Deal>(`/deals/${id}/accept`, {
      method: 'POST',
      body: JSON.stringify({ channel_owner_id }),
    })
  },

  declineDeal: async (id: number, reason?: string): Promise<ApiResponse<Deal>> => {
    return await apiRequest<Deal>(`/deals/${id}/decline`, {
      method: 'POST',
      body: JSON.stringify({ dealId: id, reason }),
    })
  },

  confirmPayment: async (id: number, tx_hash: string): Promise<ApiResponse<Deal>> => {
    return await apiRequest<Deal>(`/deals/${id}/confirm-payment`, {
      method: 'POST',
      body: JSON.stringify({ tx_hash }),
    })
  },

  submitCreative: async (request: SubmitCreativeRequest): Promise<ApiResponse<Creative>> => {
    return await apiRequest<Creative>(`/deals/${request.deal_id}/creative`, {
      method: 'POST',
      body: JSON.stringify(request),
    })
  },

  approveCreative: async (dealId: number): Promise<ApiResponse<Creative>> => {
    return await apiRequest<Creative>(`/deals/${dealId}/creative/approve`, {
      method: 'POST',
    })
  },

  requestCreativeRevision: async (
    dealId: number,
    revision_notes: string
  ): Promise<ApiResponse<Creative>> => {
    return await apiRequest<Creative>(`/deals/${dealId}/creative/revision`, {
      method: 'POST',
      body: JSON.stringify({ revision_notes }),
    })
  },

  updateDealMessage: async (
    dealId: number,
    message_text: string
  ): Promise<ApiResponse<Deal>> => {
    return await apiRequest<Deal>(`/deals/${dealId}/update-message`, {
      method: 'POST',
      body: JSON.stringify({ message_text }),
    })
  },

  schedulePost: async (
    dealId: number,
    scheduled_post_time: string
  ): Promise<ApiResponse<Deal>> => {
    return await apiRequest<Deal>(`/deals/${dealId}/schedule`, {
      method: 'POST',
      body: JSON.stringify({ scheduled_post_time }),
    })
  },

  getDealCreative: async (dealId: number): Promise<ApiResponse<Creative>> => {
    return await apiRequest<Creative>(`/deals/${dealId}/creative`)
  },

  getUser: async (telegramId: number): Promise<ApiResponse<{ registered: boolean; user: User | null }>> => {
    const queryParams = new URLSearchParams({
      telegram_id: telegramId.toString(),
    })
    return await apiRequest<{ registered: boolean; user: User | null }>(`/user/me?${queryParams.toString()}`)
  },

  registerUser: async (request: RegisterUserRequest): Promise<ApiResponse<{ registered: boolean; user: User | null }>> => {
    return await apiRequest<{ registered: boolean; user: User | null }>('/user/register', {
      method: 'POST',
      body: JSON.stringify({
        telegram_id: request.user_id,
        username: request.username,
        first_name: request.first_name,
        last_name: request.last_name,
        is_channel_owner: request.roles.includes('channel_owner'),
        is_advertiser: request.roles.includes('advertiser'),
      }),
    })
  },

  // Auth methods
  loginWithTelegramMiniApp: async (initData: string): Promise<LoginResponse> => {
    const response = await apiRequest<{
      accessToken: string
      user: {
        id: number
        username?: string
        telegramId: number
        firstName?: string
        lastName?: string
        photoUrl?: string
        languageCode?: string
        isPremium?: boolean
        isChannelOwner: boolean
        isAdvertiser: boolean
      }
    }>('/auth/telegram/webapp', {
      method: 'POST',
      body: JSON.stringify({ initData }),
      skipAuthCheck: true,
    })
    if (!response.ok || !response.data) {
      throw new Error(response.error || 'Login failed')
    }
    // Convert backend format to frontend format
    const backendData = response.data
    return {
      accessToken: backendData.accessToken,
      user: {
        id: backendData.user.id,
        telegram_id: backendData.user.telegramId,
        telegramId: backendData.user.telegramId,
        username: backendData.user.username,
        first_name: backendData.user.firstName,
        firstName: backendData.user.firstName,
        last_name: backendData.user.lastName,
        lastName: backendData.user.lastName,
        is_channel_owner: backendData.user.isChannelOwner,
        isChannelOwner: backendData.user.isChannelOwner,
        is_advertiser: backendData.user.isAdvertiser,
        isAdvertiser: backendData.user.isAdvertiser,
        photoUrl: backendData.user.photoUrl,
        languageCode: backendData.user.languageCode,
        isPremium: backendData.user.isPremium,
      },
    }
  },

  loginWithTelegramWidget: async (telegramUser: TelegramWidgetUser): Promise<LoginResponse> => {
    const response = await apiRequest<{
      accessToken: string
      user: {
        id: number
        username?: string
        telegramId: number
        firstName?: string
        lastName?: string
        photoUrl?: string
        languageCode?: string
        isPremium?: boolean
        isChannelOwner: boolean
        isAdvertiser: boolean
      }
    }>('/auth/telegram/widget', {
      method: 'POST',
      body: JSON.stringify(telegramUser),
      skipAuthCheck: true,
    })
    if (!response.ok || !response.data) {
      throw new Error(response.error || 'Login failed')
    }
    // Convert backend format to frontend format
    const backendData = response.data
    return {
      accessToken: backendData.accessToken,
      user: {
        id: backendData.user.id,
        telegram_id: backendData.user.telegramId,
        telegramId: backendData.user.telegramId,
        username: backendData.user.username,
        first_name: backendData.user.firstName,
        firstName: backendData.user.firstName,
        last_name: backendData.user.lastName,
        lastName: backendData.user.lastName,
        is_channel_owner: backendData.user.isChannelOwner,
        isChannelOwner: backendData.user.isChannelOwner,
        is_advertiser: backendData.user.isAdvertiser,
        isAdvertiser: backendData.user.isAdvertiser,
        photoUrl: backendData.user.photoUrl,
        languageCode: backendData.user.languageCode,
        isPremium: backendData.user.isPremium,
      },
    }
  },

  getMe: async (): Promise<User> => {
    const response = await apiRequest<{
      id: string
      username?: string
      telegramId: number
      firstName?: string
      lastName?: string
      photoUrl?: string
      languageCode?: string
      isPremium?: boolean
      isChannelOwner: boolean
      isAdvertiser: boolean
      createdAt: string
    }>('/auth/me')
    if (!response.ok || !response.data) {
      throw new Error(response.error || 'Failed to get user')
    }
    // Convert backend format to frontend format
    const backendUser = response.data
    const telegramId = backendUser.telegramId && typeof backendUser.telegramId === 'string' ? parseInt(backendUser.telegramId) : backendUser.telegramId;
    return {
      id: Number(backendUser.id),
      telegram_id: telegramId,
      telegramId: telegramId,
      username: backendUser.username,
      first_name: backendUser.firstName,
      firstName: backendUser.firstName,
      last_name: backendUser.lastName,
      lastName: backendUser.lastName,
      is_channel_owner: backendUser.isChannelOwner,
      isChannelOwner: backendUser.isChannelOwner,
      is_advertiser: backendUser.isAdvertiser,
      isAdvertiser: backendUser.isAdvertiser,
      created_at: backendUser.createdAt,
      createdAt: backendUser.createdAt,
      photoUrl: backendUser.photoUrl,
      languageCode: backendUser.languageCode,
      isPremium: backendUser.isPremium,
    }
  },

  logout: async (): Promise<void> => {
    await apiRequest('/auth/logout', {
      method: 'POST',
    })
  },
}
