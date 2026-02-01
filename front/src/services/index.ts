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
} from '@types'
import { isProd } from '@utils'

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
  options?: RequestInit
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
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
    const queryParams = filters
      ? '?' + new URLSearchParams(filters as Record<string, string>).toString()
      : ''
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

  rejectDeal: async (id: number): Promise<ApiResponse<Deal>> => {
    return await apiRequest<Deal>(`/deals/${id}/reject`, {
      method: 'POST',
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

  schedulePost: async (
    dealId: number,
    scheduled_post_time: string
  ): Promise<ApiResponse<Deal>> => {
    return await apiRequest<Deal>(`/deals/${dealId}/schedule`, {
      method: 'POST',
      body: JSON.stringify({ scheduled_post_time }),
    })
  },

  cancelDeal: async (id: number, reason?: string): Promise<ApiResponse<Deal>> => {
    return await apiRequest<Deal>(`/deals/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    })
  },

  getDealCreative: async (dealId: number): Promise<ApiResponse<Creative>> => {
    return await apiRequest<Creative>(`/deals/${dealId}/creative`)
  },
}
