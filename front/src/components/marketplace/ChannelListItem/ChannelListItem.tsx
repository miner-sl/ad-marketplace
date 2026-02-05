import { useNavigate } from 'react-router-dom'
import {
  GroupItem,
  BlockNew,
  Text,
  Image,
  Icon,
  AdFormatBadge,
  ChannelStatusBadge,
} from '@components'
import { ROUTES_NAME } from '@routes'
import { pluralize, hapticFeedback } from '@utils'
import type { EnhancedChannel } from '@store-new'

interface ChannelListItemProps {
  channel: EnhancedChannel
  showAdFormats?: boolean
  showTopic?: boolean
  showStatus?: boolean
  showOwner?: boolean
}

export const ChannelListItem = ({
  channel,
  showAdFormats = false,
  showTopic = false,
  showStatus = false,
  showOwner = false,
}: ChannelListItemProps) => {
  const navigate = useNavigate()
  const {
    channelName,
    subscribersCount,
    postPricing,
    activeAdFormats,
    topic,
    is_verified,
    isOwner,
    is_active,
  } = channel

  const channelStatus: 'active' | 'inactive' | 'moderation' = is_active
    ? 'active'
    : 'inactive'

  const handleClick = () => {
    hapticFeedback('soft')
    navigate(
      ROUTES_NAME.MARKETPLACE_CHANNEL_DETAILS.replace(
        ':id',
        channel.id.toString()
      )
    )
  }

  return (
    <GroupItem
      text={
        <BlockNew row align="center" gap={8}>
          <Text type="text" weight="bold">
            {channelName}
          </Text>
          {is_verified && <Icon name="verified" size={16} />}
          {showOwner && isOwner && (
            <div
              style={{
                padding: '2px 4px',
                borderRadius: '6px',
                background: 'rgba(33, 150, 243, 0.1)',
              }}
            >
              <Text type="caption" color="accent" weight="medium">
                Owner
              </Text>
            </div>
          )}
          {showAdFormats && activeAdFormats.length > 0 && (
            <BlockNew row gap={4} align="center">
              {activeAdFormats.map((format) => (
                <AdFormatBadge key={format} format={format} />
              ))}
            </BlockNew>
          )}

        </BlockNew>
      }
      description={
        <BlockNew gap={6} row align="center" fadeIn={false}>
          {subscribersCount > 0 && (
            <>
              <Text type="caption2" color="tertiary">
                {pluralize(['member', 'members', 'members'], subscribersCount)}
              </Text>
              <Text type="caption2" color="tertiary">
                •
              </Text>
            </>
          )}
          {postPricing && (
            <Text type="caption2" color="accent">
              {postPricing.price_ton} USDT
            </Text>
          )}
          {showTopic && topic && (
            <div
              style={{
                padding: '2px 4px',
                borderRadius: '6px',
                background: 'var(--color-background-tertiary)',
              }}
            >
              <Text type="caption" color="secondary" weight="medium">
                {topic.name}
              </Text>
            </div>
          )}
          {showStatus && <ChannelStatusBadge status={channelStatus} />}
        </BlockNew>
      }
      chevron
      before={
        <Image
          src={null}
          size={40}
          borderRadius={50}
          fallback={channelName}
        />
      }
      onClick={handleClick}
    />
  )
}
