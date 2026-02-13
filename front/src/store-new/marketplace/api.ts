import {MarketplaceService, type ValidateChannelResponse} from '@services'
import type {
  Channel,
  ChannelFilters,
  ChannelListing,
  Campaign,
  CampaignFilters,
  Deal,
  DealFilters,
  DealRequestsFilters,
  DealRequestsResponse,
  CreateChannelRequest,
  UpdateChannelRequest,
  CreateChannelListingRequest,
  CreateCampaignRequest,
  CreateDealRequest,
  SubmitCreativeRequest,
  SetChannelPricingRequest,
  ChannelPricing,
  Creative,
} from '@types'

export const channelsAPI = {
  getChannels: async (filters?: ChannelFilters): Promise<Channel[]> => {
    const { data, ok, error } = await MarketplaceService.getChannels(filters)
    if (!ok || !data) {
      throw new Error(error || 'Failed to fetch channels')
    }
    return data
  },

  getChannel: async (id: number): Promise<Channel> => {
    const { data, ok, error } = await MarketplaceService.getChannel(id)
    if (!ok || !data) {
      throw new Error(error || 'Failed to fetch channel')
    }
    return data
  },

  getChannelStats: async (id: number): Promise<Channel['stats']> => {
    const { data, ok, error } = await MarketplaceService.getChannelStats(id)
    if (!ok || !data) {
      throw new Error(error || 'Failed to fetch channel stats')
    }
    return data
  },

  setChannelPricing: async (
    request: SetChannelPricingRequest
  ): Promise<ChannelPricing> => {
    const { data, ok, error } =
      await MarketplaceService.setChannelPricing(request)
    if (!ok || !data) {
      throw new Error(error || 'Failed to set channel pricing')
    }
    return data
  },

  validateChannel: async (channelName: string): Promise<ValidateChannelResponse> => {
    const { data, ok, error } = await MarketplaceService.validateChannel(channelName)
    if (!ok || !data) {
      throw new Error(error || 'Failed to validate channel')
    }
    return data
  },

  createChannel: async (request: CreateChannelRequest): Promise<Channel> => {
    const { data, ok, error } = await MarketplaceService.createChannel(request)
    if (!ok || !data) {
      throw new Error(error || 'Failed to create channel')
    }
    return data
  },

  updateChannelStatus: async (
    id: number,
    is_active: boolean
  ): Promise<{ id: number; is_active: boolean; message: string }> => {
    const { data, ok, error } = await MarketplaceService.updateChannelStatus(id, is_active)
    if (!ok || !data) {
      throw new Error(error || 'Failed to update channel status')
    }
    return data
  },

  updateChannel: async (
    id: number,
    request: UpdateChannelRequest
  ): Promise<{ id: number; is_active: boolean; topic_id?: number | null }> => {
    const { data, ok, error } = await MarketplaceService.updateChannel(id, request)
    if (!ok || !data) {
      throw new Error(error || 'Failed to update channel')
    }
    return data
  },
}

export const channelListingsAPI = {
  getChannelListings: async (filters?: {
    channel_id?: number
    is_active?: boolean
  }): Promise<ChannelListing[]> => {
    const { data, ok, error } =
      await MarketplaceService.getChannelListings(filters)
    if (!ok || !data) {
      throw new Error(error || 'Failed to fetch channel listings')
    }
    return data
  },

  getChannelListing: async (id: number): Promise<ChannelListing> => {
    const { data, ok, error } = await MarketplaceService.getChannelListing(id)
    if (!ok || !data) {
      throw new Error(error || 'Failed to fetch channel listing')
    }
    return data
  },

  createChannelListing: async (
    request: CreateChannelListingRequest
  ): Promise<ChannelListing> => {
    const { data, ok, error } =
      await MarketplaceService.createChannelListing(request)
    if (!ok || !data) {
      throw new Error(error || 'Failed to create channel listing')
    }
    return data
  },

  updateChannelListing: async (
    id: number,
    data: Partial<CreateChannelListingRequest> & { is_active?: boolean }
  ): Promise<ChannelListing> => {
    const { data: result, ok, error } =
      await MarketplaceService.updateChannelListing(id, data)
    if (!ok || !result) {
      throw new Error(error || 'Failed to update channel listing')
    }
    return result
  },

  deleteChannelListing: async (id: number): Promise<void> => {
    const { ok, error } = await MarketplaceService.deleteChannelListing(id)
    if (!ok) {
      throw new Error(error || 'Failed to delete channel listing')
    }
  },
}

export const campaignsAPI = {
  getCampaigns: async (filters?: CampaignFilters): Promise<Campaign[]> => {
    const { data, ok, error } = await MarketplaceService.getCampaigns(filters)
    if (!ok || !data) {
      throw new Error(error || 'Failed to fetch campaigns')
    }
    return data
  },

  getCampaign: async (id: number): Promise<Campaign> => {
    const { data, ok, error } = await MarketplaceService.getCampaign(id)
    if (!ok || !data) {
      throw new Error(error || 'Failed to fetch campaign')
    }
    return data
  },

  createCampaign: async (request: CreateCampaignRequest): Promise<Campaign> => {
    const { data, ok, error } = await MarketplaceService.createCampaign(request)
    if (!ok || !data) {
      throw new Error(error || 'Failed to create campaign')
    }
    return data
  },

  updateCampaign: async (
    id: number,
    data: Partial<CreateCampaignRequest> & { status?: Campaign['status'] }
  ): Promise<Campaign> => {
    const { data: result, ok, error } =
      await MarketplaceService.updateCampaign(id, data)
    if (!ok || !result) {
      throw new Error(error || 'Failed to update campaign')
    }
    return result
  },

  deleteCampaign: async (id: number): Promise<void> => {
    const { ok, error } = await MarketplaceService.deleteCampaign(id)
    if (!ok) {
      throw new Error(error || 'Failed to delete campaign')
    }
  },
}

export const dealsAPI = {
  getDeals: async (filters?: DealFilters): Promise<Deal[]> => {
    const { data, ok, error } = await MarketplaceService.getDeals(filters)
    if (!ok || !data) {
      throw new Error(error || 'Failed to fetch deals')
    }
    return data
  },

  getDeal: async (id: number, userId?: number): Promise<Deal> => {
    const { data, ok, error } = await MarketplaceService.getDeal(id, userId)
    if (!ok || !data) {
      throw new Error(error || 'Failed to fetch deal')
    }
    return data
  },

  getDealRequests: async (
    telegramId: number,
    filters?: DealRequestsFilters
  ): Promise<DealRequestsResponse> => {
    const { data, ok, error } = await MarketplaceService.getDealRequests(telegramId, filters)
    if (!ok || !data) {
      throw new Error(error || 'Failed to fetch deal requests')
    }
    return data
  },

  createDeal: async (request: CreateDealRequest): Promise<Deal> => {
    const { data, ok, error } = await MarketplaceService.createDeal(request)
    if (!ok || !data) {
      throw new Error(error || 'Failed to create deal')
    }
    return data
  },

  acceptDeal: async (
    id: number,
    channel_owner_id: number
  ): Promise<Deal> => {
    const { data, ok, error } = await MarketplaceService.acceptDeal(
      id,
      channel_owner_id
    )
    if (!ok || !data) {
      throw new Error(error || 'Failed to accept deal')
    }
    return data
  },

  declineDeal: async (id: number, reason?: string): Promise<Deal> => {
    const { data, ok, error } = await MarketplaceService.declineDeal(id, reason)
    if (!ok || !data) {
      throw new Error(error || 'Failed to decline deal')
    }
    return data
  },

  confirmPayment: async (id: number, tx_hash: string): Promise<Deal> => {
    const { data, ok, error } = await MarketplaceService.confirmPayment(
      id,
      tx_hash
    )
    if (!ok || !data) {
      throw new Error(error || 'Failed to confirm payment')
    }
    return data
  },

  submitCreative: async (request: SubmitCreativeRequest): Promise<Creative> => {
    const { data, ok, error } =
      await MarketplaceService.submitCreative(request)
    if (!ok || !data) {
      throw new Error(error || 'Failed to submit creative')
    }
    return data
  },

  approveCreative: async (dealId: number): Promise<Creative> => {
    const { data, ok, error } =
      await MarketplaceService.approveCreative(dealId)
    if (!ok || !data) {
      throw new Error(error || 'Failed to approve creative')
    }
    return data
  },

  requestCreativeRevision: async (
    dealId: number,
    notes: string
  ): Promise<Creative> => {
    const { data, ok, error } =
      await MarketplaceService.requestCreativeRevision(dealId, notes)
    if (!ok || !data) {
      throw new Error(error || 'Failed to request creative revision')
    }
    return data
  },

  updateDealMessage: async (
    dealId: number,
    message_text: string
  ): Promise<Deal> => {
    const { data, ok, error } =
      await MarketplaceService.updateDealMessage(dealId, message_text)
    if (!ok || !data) {
      throw new Error(error || 'Failed to update deal message')
    }
    return data
  },

  schedulePost: async (
    dealId: number,
    scheduled_post_time: string
  ): Promise<Deal> => {
    const { data, ok, error } = await MarketplaceService.schedulePost(
      dealId,
      scheduled_post_time
    )
    if (!ok || !data) {
      throw new Error(error || 'Failed to schedule post')
    }
    return data
  },

  getDealCreative: async (dealId: number): Promise<Creative> => {
    const { data, ok, error } = await MarketplaceService.getDealCreative(dealId)
    if (!ok || !data) {
      throw new Error(error || 'Failed to fetch deal creative')
    }
    return data
  },
}
