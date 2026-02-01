import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { TANSTACK_GC_TIME, TANSTACK_KEYS, TANSTACK_TTL } from '@utils'
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
} from '@types'

import {
  channelsAPI,
  channelListingsAPI,
  campaignsAPI,
  dealsAPI,
} from './api'

// Channels
export const useChannelsQuery = (filters?: ChannelFilters) => {
  console.log('useChannelsQuery hook called with filters:', filters)
  return useQuery<Channel[]>({
    queryKey: [...TANSTACK_KEYS.CHANNELS, filters],
    queryFn: async () => {
      console.log('useChannelsQuery queryFn executing with filters:', filters)
      const result = await channelsAPI.getChannels(filters)
      console.log('useChannelsQuery queryFn result:', result)
      return result
    },
    gcTime: TANSTACK_GC_TIME,
    staleTime: TANSTACK_TTL.CHANNELS || 60000, // 1 minute default
    refetchOnMount: true, // Always refetch when component mounts
    refetchOnWindowFocus: false, // Don't refetch on window focus
  })
}

export const useChannelQuery = (id: number) => {
  return useQuery<Channel>({
    queryKey: [...TANSTACK_KEYS.CHANNEL(id)],
    queryFn: () => channelsAPI.getChannel(id),
    enabled: !!id,
    gcTime: TANSTACK_GC_TIME,
    staleTime: TANSTACK_TTL.CHANNEL || 60000,
  })
}

export const useChannelStatsQuery = (id: number) => {
  return useQuery<Channel['stats']>({
    queryKey: [...TANSTACK_KEYS.CHANNEL_STATS(id)],
    queryFn: () => channelsAPI.getChannelStats(id),
    enabled: !!id,
    gcTime: TANSTACK_GC_TIME,
    staleTime: TANSTACK_TTL.CHANNEL_STATS || 300000, // 5 minutes default
  })
}

export const useSetChannelPricingMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: SetChannelPricingRequest) =>
      channelsAPI.setChannelPricing(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: TANSTACK_KEYS.CHANNEL(variables.channel_id),
      })
      queryClient.invalidateQueries({ queryKey: TANSTACK_KEYS.CHANNELS })
    },
  })
}

// Channel Listings
export const useChannelListingsQuery = (filters?: {
  channel_id?: number
  is_active?: boolean
}) => {
  return useQuery<ChannelListing[]>({
    queryKey: [...TANSTACK_KEYS.CHANNEL_LISTINGS, filters],
    queryFn: () => channelListingsAPI.getChannelListings(filters),
    gcTime: TANSTACK_GC_TIME,
    staleTime: TANSTACK_TTL.CHANNEL_LISTINGS || 60000,
  })
}

export const useChannelListingQuery = (id: number) => {
  return useQuery<ChannelListing>({
    queryKey: [...TANSTACK_KEYS.CHANNEL_LISTING(id)],
    queryFn: () => channelListingsAPI.getChannelListing(id),
    enabled: !!id,
    gcTime: TANSTACK_GC_TIME,
    staleTime: TANSTACK_TTL.CHANNEL_LISTING || 60000,
  })
}

export const useCreateChannelListingMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateChannelListingRequest) =>
      channelListingsAPI.createChannelListing(data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: TANSTACK_KEYS.CHANNEL_LISTINGS,
      })
    },
  })
}

export const useUpdateChannelListingMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number
      data: Partial<CreateChannelListingRequest> & { is_active?: boolean }
    }) => channelListingsAPI.updateChannelListing(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: TANSTACK_KEYS.CHANNEL_LISTING(variables.id),
      })
      queryClient.invalidateQueries({
        queryKey: TANSTACK_KEYS.CHANNEL_LISTINGS,
      })
    },
  })
}

export const useDeleteChannelListingMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => channelListingsAPI.deleteChannelListing(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: TANSTACK_KEYS.CHANNEL_LISTINGS,
      })
    },
  })
}

// Campaigns
export const useCampaignsQuery = (filters?: CampaignFilters) => {
  return useQuery<Campaign[]>({
    queryKey: [...TANSTACK_KEYS.CAMPAIGNS, filters],
    queryFn: () => campaignsAPI.getCampaigns(filters),
    gcTime: TANSTACK_GC_TIME,
    staleTime: TANSTACK_TTL.CAMPAIGNS || 60000,
  })
}

export const useCampaignQuery = (id: number) => {
  return useQuery<Campaign>({
    queryKey: [...TANSTACK_KEYS.CAMPAIGN(id)],
    queryFn: () => campaignsAPI.getCampaign(id),
    enabled: !!id,
    gcTime: TANSTACK_GC_TIME,
    staleTime: TANSTACK_TTL.CAMPAIGN || 60000,
  })
}

export const useCreateCampaignMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateCampaignRequest) =>
      campaignsAPI.createCampaign(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TANSTACK_KEYS.CAMPAIGNS })
    },
  })
}

export const useUpdateCampaignMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number
      data: Partial<CreateCampaignRequest> & { status?: Campaign['status'] }
    }) => campaignsAPI.updateCampaign(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: TANSTACK_KEYS.CAMPAIGN(variables.id),
      })
      queryClient.invalidateQueries({ queryKey: TANSTACK_KEYS.CAMPAIGNS })
    },
  })
}

export const useDeleteCampaignMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => campaignsAPI.deleteCampaign(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TANSTACK_KEYS.CAMPAIGNS })
    },
  })
}

// Deals
export const useDealsQuery = (filters?: DealFilters) => {
  return useQuery<Deal[]>({
    queryKey: [...TANSTACK_KEYS.DEALS, filters],
    queryFn: async () => await dealsAPI.getDeals(filters),
  })
}

export const useDealQuery = (id: number, userId?: number) => {
  return useQuery<Deal>({
    queryKey: [...TANSTACK_KEYS.DEAL(id), userId],
    queryFn: () => dealsAPI.getDeal(id, userId),
    enabled: !!id,
    gcTime: TANSTACK_GC_TIME,
    staleTime: TANSTACK_TTL.DEAL || 30000,
  })
}

export const useDealRequestsQuery = (telegramId: number | undefined, limit?: number) => {
  return useQuery<Deal[]>({
    queryKey: [...TANSTACK_KEYS.DEAL_REQUESTS(telegramId || 0)],
    queryFn: () => dealsAPI.getDealRequests(telegramId!, limit),
    enabled: !!telegramId,
    gcTime: TANSTACK_GC_TIME,
    staleTime: TANSTACK_TTL.DEAL_REQUESTS || 30000,
  })
}

export const useCreateDealMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateDealRequest) => dealsAPI.createDeal(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TANSTACK_KEYS.DEALS })
    },
  })
}

export const useAcceptDealMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, channel_owner_id }: { id: number; channel_owner_id: number }) =>
      dealsAPI.acceptDeal(id, channel_owner_id),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: TANSTACK_KEYS.DEAL(variables.id),
      })
      queryClient.invalidateQueries({ queryKey: TANSTACK_KEYS.DEALS })
    },
  })
}

export const useRejectDealMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => dealsAPI.rejectDeal(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: TANSTACK_KEYS.DEAL(id) })
      queryClient.invalidateQueries({ queryKey: TANSTACK_KEYS.DEALS })
    },
  })
}

export const useConfirmPaymentMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, tx_hash }: { id: number; tx_hash: string }) =>
      dealsAPI.confirmPayment(id, tx_hash),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: TANSTACK_KEYS.DEAL(variables.id),
      })
      queryClient.invalidateQueries({ queryKey: TANSTACK_KEYS.DEALS })
    },
  })
}

export const useSubmitCreativeMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: SubmitCreativeRequest) =>
      dealsAPI.submitCreative(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: TANSTACK_KEYS.DEAL(variables.deal_id),
      })
      queryClient.invalidateQueries({ queryKey: TANSTACK_KEYS.DEALS })
    },
  })
}

export const useApproveCreativeMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (dealId: number) => dealsAPI.approveCreative(dealId),
    onSuccess: (_, dealId) => {
      queryClient.invalidateQueries({ queryKey: TANSTACK_KEYS.DEAL(dealId) })
      queryClient.invalidateQueries({ queryKey: TANSTACK_KEYS.DEALS })
    },
  })
}

export const useRequestCreativeRevisionMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      dealId,
      revision_notes,
    }: {
      dealId: number
      revision_notes: string
    }) => dealsAPI.requestCreativeRevision(dealId, revision_notes),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: TANSTACK_KEYS.DEAL(variables.dealId),
      })
      queryClient.invalidateQueries({ queryKey: TANSTACK_KEYS.DEALS })
    },
  })
}

export const useSchedulePostMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      dealId,
      scheduled_post_time,
    }: {
      dealId: number
      scheduled_post_time: string
    }) => dealsAPI.schedulePost(dealId, scheduled_post_time),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: TANSTACK_KEYS.DEAL(variables.dealId),
      })
      queryClient.invalidateQueries({ queryKey: TANSTACK_KEYS.DEALS })
    },
  })
}

export const useCancelDealMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason?: string }) =>
      dealsAPI.cancelDeal(id, reason),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: TANSTACK_KEYS.DEAL(variables.id),
      })
      queryClient.invalidateQueries({ queryKey: TANSTACK_KEYS.DEALS })
    },
  })
}

export const useDealCreativeQuery = (dealId: number) => {
  return useQuery({
    queryKey: [...TANSTACK_KEYS.DEAL_CREATIVE(dealId)],
    queryFn: () => dealsAPI.getDealCreative(dealId),
    enabled: !!dealId,
    gcTime: TANSTACK_GC_TIME,
    staleTime: TANSTACK_TTL.DEAL_CREATIVE || 30000,
  })
}
