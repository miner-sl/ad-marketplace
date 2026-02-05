import { openTelegramLink } from '@tma.js/sdk-react'
import {BlockNew, Text, type TextTypes} from '@components'
import type { Channel } from '@types'
import { getChannelLink } from '@utils'

interface ChannelLinkProps {
  channel?: Channel | null
  showLabel?: boolean
  textType?: TextTypes
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

  const channelLink = getChannelLink(channel)
  const channelName = channel.title || `@${channel.username || 'channel'}`

  const handleChannelClick = () => {
    if (channelLink) {
      openTelegramLink(channelLink)
    }
  }

  return (
    <BlockNew row>
      {channelLink ? (
        <Text
          type={textType}
          weight={weight}
          color="accent"
          onClick={handleChannelClick}
        >
          {showLabel ? `Channel: ${channelName}` : channelName}
        </Text>
      ) : (
        <Text type={textType} weight={weight}>
          {showLabel ? `Channel: ${channelName}` : channelName}
        </Text>
      )}
    </BlockNew>
  )
}
