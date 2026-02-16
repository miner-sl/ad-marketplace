import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'
import {useAuth} from '@context'
import {
  collapseAddress,
  createMembersCount,
  separateNumber,
  TANSTACK_GC_TIME,
  TANSTACK_KEYS,
  TANSTACK_TTL
} from '@utils'
import type {
  AdFormat,
  Campaign,
  CampaignFilters,
  Channel,
  ChannelFilters,
  ChannelListing,
  ChannelPricing,
  CreateCampaignRequest,
  CreateChannelListingRequest,
  CreateChannelRequest,
  CreateDealRequest,
  Deal,
  DealFilters,
  DealMessage,
  DealRequestsFilters,
  DealRequestsResponse,
  SetChannelPricingRequest,
  SubmitCreativeRequest,
  UpdateChannelRequest,
} from '@types'
import {PREDEFINED_TOPICS} from '../../common/constants/topics'

import {campaignsAPI, channelListingsAPI, channelsAPI, dealsAPI,} from './api'
import type {ValidateChannelResponse} from '@services';

export interface EnhancedChannel extends Omit<Channel, 'topic'> {
  activeAdFormats: AdFormat[]
  topic: { id: number; name: string } | undefined
  channelName: string
  subscribersCount: number
  postPricing: ChannelPricing | undefined
  isOwner: boolean
}

export interface EnhancedDeal extends Deal {
  formattedPostVerificationTime?: string
  formattedScheduledPostTime?: string
  formattedEscrowAddress?: string
  advertiserDisplayName?: string
  formattedSubscribersCount?: string
  formattedAverageViews?: string
  formattedAverageReach?: string
  formattedMembersCount?: string
  revisionMessages: DealMessage[]
  postLink?: string
  paymentTxLink?: string
}

// Channels
export const useChannelsQuery = (filters?: ChannelFilters) => {
  const {user} = useAuth()
  const userId = user?.id

  return useQuery<Channel[], Error, EnhancedChannel[]>({
    queryKey: [...TANSTACK_KEYS.CHANNELS, filters],
    queryFn: async () => {
      const result = await channelsAPI.getChannels(filters)
      return result
    },
    select: (channels: Channel[]): EnhancedChannel[] => {
      return channels.map((channel) => {
        const activePricing = channel.pricing?.filter((p) => p.is_active) || []
        const activeAdFormats = activePricing.filter(p => p.ad_format === 'post').map((p) => p.ad_format)
        const topic =
          channel.topic ||
          (channel.topic_id
            ? PREDEFINED_TOPICS.find((t) => t.id === channel.topic_id) || undefined
            : undefined)
        const channelName = channel.title || `@${channel.username || 'channel'}`
        const subscribersCount = channel.stats?.subscribers_count || 0
        const postPricing = channel.pricing?.find((p) => p.ad_format === 'post' && p.is_active)
        const isOwner = userId !== undefined && userId === channel.owner_id

        return {
          ...channel,
          activeAdFormats,
          topic,
          channelName,
          subscribersCount,
          postPricing,
          isOwner,
        } as EnhancedChannel
      })
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

export const useValidateChannelMutation = () => {
  return useMutation({
    mutationFn: (channelName: string): Promise<ValidateChannelResponse> => channelsAPI.validateChannel(channelName),
  });
}

export const useCreateChannelMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateChannelRequest) => channelsAPI.createChannel(data),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: TANSTACK_KEYS.CHANNELS})
    },
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
      queryClient.invalidateQueries({queryKey: TANSTACK_KEYS.CHANNELS})
    },
  })
}

export const useUpdateChannelStatusMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({id, is_active}: { id: number; is_active: boolean }) =>
      channelsAPI.updateChannelStatus(id, is_active),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: TANSTACK_KEYS.CHANNEL(variables.id),
      })
      queryClient.invalidateQueries({queryKey: TANSTACK_KEYS.CHANNELS})
    },
  })
}

export const useUpdateChannelMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({id, data}: { id: number; data: UpdateChannelRequest }) =>
      channelsAPI.updateChannel(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: TANSTACK_KEYS.CHANNEL(variables.id),
      })
      queryClient.invalidateQueries({queryKey: TANSTACK_KEYS.CHANNELS})
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
      queryClient.invalidateQueries({queryKey: TANSTACK_KEYS.CAMPAIGNS})
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
      queryClient.invalidateQueries({queryKey: TANSTACK_KEYS.CAMPAIGNS})
    },
  })
}

export const useDeleteCampaignMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => campaignsAPI.deleteCampaign(id),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: TANSTACK_KEYS.CAMPAIGNS})
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

function buildPostLink(channelUsername: string | undefined, telegramChannelId: number, messageId: number): string {
  if (channelUsername) {
    return `https://t.me/${channelUsername.replace('@', '')}/${messageId}`;
  } else if (telegramChannelId) {
    // Convert channel ID format: -1001234567890 -> 1234567890
    const channelIdStr = telegramChannelId.toString().replace('-100', '');
    return `https://t.me/c/${channelIdStr}/${messageId}`;
  }
  return '';
}

export function buildTonscanTxLink(txHash: string | undefined) {
  if (!txHash) return undefined;

  // const baseUrl = config?.isDev
  //   ? 'https://testnet.tonscan.org'
  //   : 'https://tonscan.org';

  const baseUrl = 'https://tonscan.org';
  const encodedHash = encodeURIComponent(txHash);
  return `${baseUrl}/tx/${encodedHash}`;
}

const postLinkStatus = new Set(['posted', 'verified', 'confirmed']);

export const useDealQuery = (id: number, userId?: number) => {
  return useQuery<Deal, Error, EnhancedDeal>({
    queryKey: [...TANSTACK_KEYS.DEAL(id), userId],
    queryFn: () => dealsAPI.getDeal(id, userId),
    select: (deal) => {
      const formattedScheduledPostTime = deal.scheduled_post_time
        ? new Date(deal.scheduled_post_time).toLocaleString()
        : undefined

      const formattedPostVerificationTime = deal.post_verification_until
        ? new Date(deal.post_verification_until).toLocaleString()
        : undefined

      const formattedEscrowAddress = deal.escrow_address
        ? collapseAddress(deal.escrow_address, 4)
        : undefined

      const advertiserDisplayName =
        typeof deal.advertiser === 'object' && deal.advertiser !== null
          ? deal.advertiser.username
            ? `@${deal.advertiser.username}`
            : deal.advertiser.first_name || `User #${deal.advertiser.telegram_id}`
          : undefined

      const channelStats = deal.channel?.stats
      const subscribersCount = channelStats?.subscribers_count || 0
      const averageViews = channelStats?.average_views
      const averageReach = channelStats?.average_reach

      const formattedSubscribersCount = subscribersCount > 0
        ? separateNumber(subscribersCount)
        : undefined

      const formattedAverageViews = averageViews
        ? separateNumber(averageViews)
        : undefined

      const formattedAverageReach = averageReach
        ? separateNumber(averageReach)
        : undefined

      const formattedMembersCount = subscribersCount > 0
        ? createMembersCount(subscribersCount)
        : undefined

      const revisionMessages = deal.messages && deal.messages.length >= 1 ? deal.messages.slice(1).filter(msg => msg.message_text.startsWith('Revision: ')) : [];

      return {
        ...deal,
        postLink: postLinkStatus.has(deal.status) && deal.channel && deal.post_message_id ?
          buildPostLink(deal.channel?.username, deal.channel.telegram_channel_id, deal.post_message_id)
          : undefined,
        revisionMessages,
        paymentTxLink: buildTonscanTxLink(deal.payment_tx_hash),
        formattedPostVerificationTime,
        formattedScheduledPostTime,
        formattedEscrowAddress,
        advertiserDisplayName,
        formattedSubscribersCount,
        formattedAverageViews,
        formattedAverageReach,
        formattedMembersCount,
      } as EnhancedDeal
    },
    enabled: !!id,
    gcTime: TANSTACK_GC_TIME,
    staleTime: TANSTACK_TTL.DEAL || 30000,
  })
}

export const useDealRequestsQuery = (
  telegramId: number | undefined,
  filters?: DealRequestsFilters
) => {
  return useQuery<DealRequestsResponse>({
    queryKey: [...TANSTACK_KEYS.DEAL_REQUESTS(telegramId || 0), filters ?? {}],
    queryFn: () => dealsAPI.getDealRequests(telegramId!, filters),
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
      queryClient.invalidateQueries({queryKey: TANSTACK_KEYS.DEALS})
    },
  })
}

export const useAcceptDealMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({id, channel_owner_id}: { id: number; channel_owner_id: number }) =>
      dealsAPI.acceptDeal(id, channel_owner_id),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: TANSTACK_KEYS.DEAL(variables.id),
      })
      queryClient.invalidateQueries({queryKey: TANSTACK_KEYS.DEALS})
    },
  })
}

export const useDeclineDealMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({id, reason}: { id: number; reason?: string }) => dealsAPI.declineDeal(id, reason),
    onSuccess: (_, {id}) => {
      queryClient.invalidateQueries({
        queryKey: TANSTACK_KEYS.DEAL(id),
      })
      queryClient.invalidateQueries({queryKey: TANSTACK_KEYS.DEALS})
    },
  })
}

export const useConfirmPaymentMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({id, tx_hash}: { id: number; tx_hash: string }) =>
      dealsAPI.confirmPayment(id, tx_hash),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: TANSTACK_KEYS.DEAL(variables.id),
      })
      queryClient.invalidateQueries({queryKey: TANSTACK_KEYS.DEALS})
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
      queryClient.invalidateQueries({queryKey: TANSTACK_KEYS.DEALS})
    },
  })
}

export const useApproveCreativeMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (dealId: number) => dealsAPI.approveCreative(dealId),
    onSuccess: (_, dealId) => {
      queryClient.invalidateQueries({queryKey: TANSTACK_KEYS.DEAL(dealId)})
      queryClient.invalidateQueries({queryKey: TANSTACK_KEYS.DEALS})
    },
  })
}

export const useRequestCreativeRevisionMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
                   dealId,
                   notes,
                 }: {
      dealId: number
      notes: string
    }) => dealsAPI.requestCreativeRevision(dealId, notes),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: TANSTACK_KEYS.DEAL(variables.dealId),
      })
      queryClient.invalidateQueries({queryKey: TANSTACK_KEYS.DEALS})
    },
  })
}

export const useUpdateDealMessageMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
                   dealId,
                   message_text,
                 }: {
      dealId: number
      message_text: string
    }) => dealsAPI.updateDealMessage(dealId, message_text),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: TANSTACK_KEYS.DEAL(variables.dealId),
      })
      queryClient.invalidateQueries({queryKey: TANSTACK_KEYS.DEALS})
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
      queryClient.invalidateQueries({queryKey: TANSTACK_KEYS.DEALS})
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
