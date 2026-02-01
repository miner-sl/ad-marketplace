import type { ChatsPopularOrderBy } from '@types'

export const API_VALIDATION_ERROR = 'Fill fields correctly'

export const API_ERRORS = {}

export const TANSTACK_KEYS = {
  AUTH: ['auth'],
  USER: ['user'],
  CHATS_POPULAR: (sortBy: ChatsPopularOrderBy) => ['chats', 'popular', sortBy],
  CHAT: (slug: string) => ['chat', slug],
  ADMIN_CHATS: ['admin', 'chats'],
  // Marketplace
  CHANNELS: ['marketplace', 'channels'],
  CHANNEL: (id: number) => ['marketplace', 'channels', id],
  CHANNEL_STATS: (id: number) => ['marketplace', 'channels', id, 'stats'],
  CHANNEL_LISTINGS: ['marketplace', 'channel-listings'],
  CHANNEL_LISTING: (id: number) => ['marketplace', 'channel-listings', id],
  CAMPAIGNS: ['marketplace', 'campaigns'],
  CAMPAIGN: (id: number) => ['marketplace', 'campaigns', id],
  DEALS: ['marketplace', 'deals'],
  DEAL: (id: number) => ['marketplace', 'deals', id],
  DEAL_CREATIVE: (dealId: number) => ['marketplace', 'deals', dealId, 'creative'],
  DEAL_REQUESTS: (telegramId: number) => ['marketplace', 'deals', 'requests', telegramId],
}

export const TANSTACK_TTL = {
  AUTH: 5 * 60 * 1000, // 5 minute
  USER: 1 * 60 * 1000, // 1 minute
  CHATS_POPULAR: 5 * 60 * 1000, // 5 minute
  ADMIN_CHATS: 5 * 60 * 1000, // 5 minute
  CHAT: 5 * 60 * 1000, // 5 minute
  // Marketplace
  CHANNELS: 1 * 60 * 1000, // 1 minute
  CHANNEL: 1 * 60 * 1000, // 1 minute
  CHANNEL_STATS: 5 * 60 * 1000, // 5 minutes
  CHANNEL_LISTINGS: 1 * 60 * 1000, // 1 minute
  CHANNEL_LISTING: 1 * 60 * 1000, // 1 minute
  CAMPAIGNS: 1 * 60 * 1000, // 1 minute
  CAMPAIGN: 1 * 60 * 1000, // 1 minute
  DEALS: 30 * 1000, // 30 seconds
  DEAL: 30 * 1000, // 30 seconds
  DEAL_CREATIVE: 30 * 1000, // 30 seconds
  DEAL_REQUESTS: 30 * 1000, // 30 seconds
}

export const TANSTACK_GC_TIME = 30 * 60 * 1000 // 30 minute
