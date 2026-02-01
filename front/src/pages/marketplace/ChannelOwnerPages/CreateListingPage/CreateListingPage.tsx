import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BlockNew,
  PageLayout,
  Page,
  TelegramBackButton,
  TelegramMainButton,
  Button,
  Text,
  ListInput,
} from '@components'
import {
  useChannelsQuery,
  useCreateChannelListingMutation,
} from '@store-new'
import styles from './CreateListingPage.module.scss'

export const CreateListingPage = () => {
  const navigate = useNavigate()
  const [selectedChannelId, setSelectedChannelId] = useState<number | null>(
    null
  )
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')

  const { data: channels } = useChannelsQuery()
  const createListingMutation = useCreateChannelListingMutation()

  const handleSubmit = async () => {
    if (!selectedChannelId) return

    try {
      await createListingMutation.mutateAsync({
        channel_id: selectedChannelId,
        title: title || undefined,
        description: description || undefined,
      })
      navigate('/marketplace/channel-owner/my-listings')
    } catch (error) {
      console.error('Failed to create listing:', error)
    }
  }

  return (
    <Page back>
      <PageLayout>
        <TelegramBackButton />
        <BlockNew gap={16} className={styles.container}>
        <BlockNew padding="0 16px">
          <Text type="hero" weight="bold">
            Create Channel Listing
          </Text>
        </BlockNew>

        <BlockNew gap={12}>
          <Text type="title2" weight="bold">
            Select Channel
          </Text>
          {channels && channels.length > 0 ? (
            <BlockNew gap={8}>
              {channels.map((channel) => (
                <div
                  key={channel.id}
                  onClick={() => setSelectedChannelId(channel.id)}
                  className={`${styles.channelOption} ${
                    selectedChannelId === channel.id ? styles.selected : ''
                  }`}
                >
                  <Text type="text" weight="bold">
                    {channel.title || `@${channel.username || 'channel'}`}
                  </Text>
                  {channel.stats?.subscribers_count && (
                    <Text type="caption" color="secondary">
                      {channel.stats.subscribers_count.toLocaleString()}{' '}
                      subscribers
                    </Text>
                  )}
                </div>
              ))}
            </BlockNew>
          ) : (
            <Text type="text" color="secondary">
              No channels available. Please add a channel first.
            </Text>
          )}
        </BlockNew>

        {selectedChannelId && (
          <BlockNew gap={12}>
            <BlockNew gap={4}>
              <Text type="text" weight="medium">
                Title (optional)
              </Text>
              <ListInput
                value={title}
                onChange={(value) => setTitle(value)}
                placeholder="Give your listing a title"
              />
            </BlockNew>
            <BlockNew gap={4}>
              <Text type="text" weight="medium">
                Description (optional)
              </Text>
              <ListInput
                value={description}
                onChange={(value) => setDescription(value)}
                placeholder="Describe your channel and what advertisers can expect"
              />
            </BlockNew>
          </BlockNew>
        )}

        <TelegramMainButton
          text={
            createListingMutation.isPending
              ? 'Creating...'
              : 'Create Listing'
          }
          onClick={handleSubmit}
          disabled={!selectedChannelId || createListingMutation.isPending}
        />
      </BlockNew>
      </PageLayout>
    </Page>
  )
}
