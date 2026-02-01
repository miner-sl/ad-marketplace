import { openTelegramLink } from '@tma.js/sdk-react'
import { BlockNew, Text } from '@components'
import type { Channel } from '@types'

interface ChannelLinkProps {
  channel?: Channel | null
  showLabel?: boolean
  textType?: 'hero' | 'title' | 'title1' | 'title2' | 'text' | 'link' | 'caption' | 'caption2'
  weight?: 'normal' | 'medium' | 'bold'
}

export const ChannelLink = ({ 
  channel, 
  showLabel = true,
  textType = 'text',
  weight = 'normal'
}: ChannelLinkProps) => {
  if (!channel) {
    return null
  }

  const getChannelLink = (): string | null => {
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

  const channelLink = getChannelLink()
  const channelName = channel.title || `@${channel.username || 'channel'}`

  const handleChannelClick = () => {
    if (channelLink) {
      openTelegramLink(channelLink)
    }
  }

  return (
    <BlockNew row>
      {channelLink ? (
        <span style={{ textDecoration: 'underline' }}>
          <Text
            type={textType}
            weight={weight}
            color="accent"
            onClick={handleChannelClick}
          >
            {showLabel ? `Channel: ${channelName}` : channelName}
          </Text>
        </span>
      ) : (
        <Text type={textType} weight={weight}>
          {showLabel ? `Channel: ${channelName}` : channelName}
        </Text>
      )}
    </BlockNew>
  )
}
