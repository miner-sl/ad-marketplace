import { useNavigate } from 'react-router-dom'
import {
  BlockNew,
  PageLayout,
  Page,
  TelegramBackButton,
  Text,
} from '@components'
import { ChannelCard } from '@components'
import { useChannelsQuery } from '@store-new'
import { ROUTES_NAME } from '@routes'
import styles from './BrowseChannelsPage.module.scss'

export const BrowseChannelsPage = () => {
  const navigate = useNavigate()
  const { data: channels, isLoading: channelsLoading } = useChannelsQuery({
    limit: 50,
  })

  return (
    <Page back>
      <PageLayout>
        <TelegramBackButton />
        <BlockNew gap={16} className={styles.container}>
          <BlockNew padding="0 16px">
            <Text type="hero" weight="bold">
              Browse Channels
            </Text>
            <BlockNew marginValue={8}>
              <Text type="text" color="secondary">
                Find channels for your advertising campaigns
              </Text>
            </BlockNew>
          </BlockNew>

          {channelsLoading ? (
            <Text type="text" color="secondary" align="center">
              Loading channels...
            </Text>
          ) : channels && channels.length > 0 ? (
            <BlockNew gap={8}>
              {channels.map((channel) => (
                <ChannelCard
                  key={channel.id}
                  channel={channel}
                  onClick={() =>
                    navigate(
                      ROUTES_NAME.MARKETPLACE_CHANNEL_DETAILS.replace(
                        ':id',
                        channel.id.toString()
                      )
                    )
                  }
                />
              ))}
            </BlockNew>
          ) : (
            <Text type="text" color="secondary" align="center">
              No channels available
            </Text>
          )}
        </BlockNew>
      </PageLayout>
    </Page>
  )
}
