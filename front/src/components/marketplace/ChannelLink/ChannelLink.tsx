import {openTelegramLink} from '@tma.js/sdk-react'
import {BlockNew, Text, type TextTypes} from '@components'
import type {Channel} from '@types'
import {getChannelLink} from '@utils'

interface ChannelLinkProps {
  channel?: Channel | undefined
  showLabel?: boolean
  textType?: TextTypes
  weight?: 'normal' | 'medium' | 'bold',
  children?: React.ReactNode
}

export const ChannelLink = ({
  channel,
  showLabel = true,
  textType = 'text',
  weight = 'normal',
  children
}: ChannelLinkProps) => {
  if (!channel) {
    return undefined;
  }

  const channelLink = getChannelLink(channel)
  const channelName = `@${channel.title}` || `@${channel.username || 'channel'}`

  const handleChannelClick = () => {
    if (channelLink) {
      openTelegramLink(channelLink)
    }
  }

  if (children) {
    return (
      <BlockNew onClick={handleChannelClick}>{children}</BlockNew>
    );
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
          {showLabel ? `${channelName}` : channelName}
        </Text>
      ) : (
        <Text type={textType} weight={weight}>
          {showLabel ? `${channelName}` : channelName}
        </Text>
      )}
    </BlockNew>
  )
}
