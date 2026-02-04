import type { Channel } from '@types'

/**
 * Gets the Telegram link for a channel
 * @param channel - The channel object
 * @returns The Telegram link URL or null if channel is invalid or has no link
 */
export const getChannelLink = (channel: Channel | null | undefined): string | null => {
  if (!channel) return null
  
  if (channel.username) {
    return `https://t.me/${channel.username.replace('@', '')}`
  }
  
  if (channel.telegram_channel_id) {
    // For private channels, use the channel ID format
    const channelId = channel.telegram_channel_id.toString().replace('-100', '')
    return `https://t.me/c/${channelId}`
  }
  
  return null
}
