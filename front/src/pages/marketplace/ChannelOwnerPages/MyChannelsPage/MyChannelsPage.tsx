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
import { useTelegramUser } from '@hooks'
import { ROUTES_NAME } from '@routes'
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
            <BlockNew gap={8}>
              {myChannels.map((channel) => (
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
              You don't have any channels yet.
            </Text>
          )}
        </BlockNew>
      </PageLayout>
    </Page>
  )
}
