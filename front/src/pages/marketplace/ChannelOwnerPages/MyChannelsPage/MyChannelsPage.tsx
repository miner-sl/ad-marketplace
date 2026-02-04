import { useNavigate } from 'react-router-dom'
import {
  BlockNew,
  PageLayout,
  Page,
  TelegramBackButton,
  Text,
  Group,
  GroupItem,
  Image,
  Icon,
} from '@components'
import { useChannelsQuery } from '@store-new'
import { useTelegramUser } from '@hooks'
import { ROUTES_NAME } from '@routes'
import {pluralize, hapticFeedback} from '@utils'
import styles from './MyChannelsPage.module.scss'

export const MyChannelsPage = () => {
  const navigate = useNavigate()
  const user = useTelegramUser()
  const { data: channels, isLoading } = useChannelsQuery()

  // Filter channels by owner (we'll need to check owner_id from channel data)
  // For now, showing all channels - backend should filter by owner_id
  const myChannels = channels || []

  return (
    <Page back>
      <PageLayout>
        <TelegramBackButton />
        <BlockNew gap={16} className={styles.container}>
          <BlockNew padding="0 16px">
            <Text type="title" weight="bold">
              My Channels
            </Text>
          </BlockNew>

          {isLoading ? (
            <Text type="text" color="secondary" align="center">
              Loading...
            </Text>
          ) : myChannels.length > 0 ? (
            <BlockNew id="channels-container">
              <Group>
                {myChannels.map((channel) => {
                  const channelName = channel.title || `@${channel.username || 'channel'}`
                  const subscribersCount = channel.stats?.subscribers_count || 0
                  const postPricing = channel.pricing?.find((p) => p.ad_format === 'post' && p.is_active)
                  
                  return (
                    <GroupItem
                      key={channel.id}
                      text={
                        <BlockNew row align="center" gap={8}>
                          <Text type="text" weight="bold">
                            {channelName}
                          </Text>
                          {channel.is_verified && (
                            <Icon name="verified" size={16} />
                          )}
                        </BlockNew>
                      }
                      description={
                        <BlockNew gap={6} row align="center" fadeIn={false}>
                          {subscribersCount > 0 && (
                            <>
                              <Text type="caption2" color="tertiary">
                                {pluralize(
                                  ['member', 'members', 'members'],
                                  subscribersCount
                                )}
                              </Text>
                              <Text type="caption2" color="tertiary">
                                •
                              </Text>
                            </>
                          )}
                          {postPricing && (
                            <Text type="caption2" color="accent">
                              {postPricing.price_ton} TON
                            </Text>
                          )}
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
                      onClick={() => {
                        hapticFeedback('soft')
                        navigate(
                          ROUTES_NAME.MARKETPLACE_CHANNEL_DETAILS.replace(
                            ':id',
                            channel.id.toString()
                          )
                        )
                      }}
                    />
                  )
                })}
              </Group>
            </BlockNew>
          ) : (
            <Text type="text" color="secondary" align="center">
              You don't have any channels yet.
            </Text>
          )}
        </BlockNew>
      </PageLayout>
    </Page>
  )
}
