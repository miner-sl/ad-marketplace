import { useNavigate } from 'react-router-dom'
import {
  BlockNew,
  PageLayout,
  Page,
  TelegramBackButton,
  Text,
  Group,
  ChannelListItem,
  Button,
  Icon,
} from '@components'
import { useChannelsQuery, type EnhancedChannel } from '@store-new'
import styles from './MyChannelsPage.module.scss'

export const MyChannelsPage = () => {
  const navigate = useNavigate()
  const { data: channels, isLoading } = useChannelsQuery({
    ownerTelegramId: true,
  })

  const myChannels = channels || []

  return (
    <Page back>
      <PageLayout>
        <TelegramBackButton />
        <BlockNew gap={16} className={styles.container}>
          <BlockNew row justify="between" align="center">
            <Text type="title" weight="bold">
              My Channels
            </Text>
            <Button
              type="accent"
              size="small"
              onClick={() => navigate('/marketplace/channel-owner/add-channel')}
            >
              <Icon name="plus" size={16} />
              <span style={{ marginLeft: 4 }}>Add Channel</span>
            </Button>
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
