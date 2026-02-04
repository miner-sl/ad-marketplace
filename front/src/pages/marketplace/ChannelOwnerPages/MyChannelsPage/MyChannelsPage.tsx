import {
  BlockNew,
  PageLayout,
  Page,
  TelegramBackButton,
  Text,
  Group,
  ChannelListItem,
} from '@components'
import { useChannelsQuery, type EnhancedChannel } from '@store-new'
import styles from './MyChannelsPage.module.scss'

export const MyChannelsPage = () => {
  const { data: channels, isLoading } = useChannelsQuery({
    ownerTelegramId: true,
  })

  const myChannels = channels || []

  return (
    <Page back>
      <PageLayout>
        <TelegramBackButton />
        <BlockNew gap={16} className={styles.container}>
          <BlockNew>
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
                {myChannels.map((channel: EnhancedChannel) => (
                  <ChannelListItem
                    key={channel.id}
                    channel={channel}
                    showAdFormats
                    showTopic
                    showStatus
                  />
                ))}
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
