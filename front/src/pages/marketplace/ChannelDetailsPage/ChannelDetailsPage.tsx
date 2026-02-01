import {useParams, useNavigate} from 'react-router-dom'
import {
  BlockNew,
  PageLayout,
  Page,
  TelegramBackButton,
  Text,
  TelegramMainButton,
  ChannelLink,
} from '@components'
import {useChannelQuery, useChannelStatsQuery} from '@store-new'
import {useTelegramUser} from '@hooks'
import {ROUTES_NAME} from '@routes'
import styles from './ChannelDetailsPage.module.scss'
import {separateNumber} from '@utils'

export const ChannelDetailsPage = () => {
  const {id} = useParams<{ id: string }>()
  const navigate = useNavigate()
  const channelId = id ? parseInt(id) : 0

  const {data: channel, isLoading} = useChannelQuery(channelId)
  const {data: stats} = useChannelStatsQuery(channelId)
  const telegramUser = useTelegramUser()
  const userId = telegramUser?.id

  console.log({channel})
  if (isLoading || !channel) {
    return (
      <Page back>
        <PageLayout>
          <TelegramBackButton/>
          <Text type="text" align="center">
            Loading...
          </Text>
        </PageLayout>
      </Page>
    )
  }

  const displayStats = stats || channel.stats
  const postPricing = channel.pricing?.find((p) => p.ad_format === 'post')
  const forwardPricing = channel.pricing?.find((p) => p.ad_format === 'forward')
  const storyPricing = channel.pricing?.find((p) => p.ad_format === 'story')

  const handleRequestPostClick = () => {
    navigate(ROUTES_NAME.MARKETPLACE_REQUEST_POST.replace(':id', id || ''))
  }

  return (
    <Page back>
      <PageLayout>
        <TelegramBackButton/>
        <BlockNew gap={4} className={styles.container}>
          <BlockNew padding="0 8px">
            <BlockNew gap={4}>
              <ChannelLink channel={channel} showLabel={false} textType="title2" weight="bold" />
              {channel.is_verified && (
                <Text type="caption" color="accent">
                  ✓ Verified Channel
                </Text>
              )}
            </BlockNew>
          </BlockNew>

          {channel.description && (
            <BlockNew padding="0 8px">
              <Text type="text" color="secondary">
                {channel.description}
              </Text>
            </BlockNew>
          )}

          {displayStats && (
            <BlockNew gap={2} padding="0 8px">
              <BlockNew gap={2}>
                <Text type="title2" weight="bold">
                  Statistics
                </Text>
                {displayStats.subscribers_count && (
                  <Text type="text">
                    👥 {separateNumber(displayStats.subscribers_count)} subscribers
                  </Text>
                )}
                {displayStats.average_views && (
                  <Text type="text">
                    👁️ {separateNumber(displayStats.average_views)} average views
                  </Text>
                )}
                {displayStats.average_reach && (
                  <Text type="text">
                    📊 {separateNumber(displayStats.average_reach)} average reach
                  </Text>
                )}
                {displayStats.premium_subscribers_count && (
                  <Text type="text" color="accent">
                    ⭐ {separateNumber(displayStats.premium_subscribers_count)}{' '}
                    premium subscribers
                  </Text>
                )}
              </BlockNew>
            </BlockNew>
          )}

          {channel.pricing && channel.pricing.length > 0 && (
            <BlockNew gap={2} padding="0 8px">
              <Text type="title2" weight="bold">
                Pricing
              </Text>
              {postPricing && (
                <BlockNew gap={2} row>
                  <Text type="text" weight="bold">
                    Post
                  </Text>
                  <Text type="text" color="accent">
                    {postPricing.price_ton} TON
                  </Text>
                </BlockNew>
              )}
              {forwardPricing && (
                <BlockNew gap={2} row>
                  <Text type="text" weight="bold">
                    Forward
                  </Text>
                  <Text type="text" color="accent">
                    {forwardPricing.price_ton} TON
                  </Text>
                </BlockNew>
              )}
              {storyPricing && (
                <BlockNew gap={2} row>
                  <Text type="text" weight="bold">
                    Story
                  </Text>
                  <Text type="text" color="accent">
                    {storyPricing.price_ton} TON
                  </Text>
                </BlockNew>
              )}
            </BlockNew>
          )}

          {postPricing && userId && (
            <TelegramMainButton
              text="Request Post"
              onClick={handleRequestPostClick}
              isVisible={true}
            />
          )}
        </BlockNew>
      </PageLayout>
    </Page>
  )
}
