import {useParams, useNavigate} from 'react-router-dom'
import {useState} from 'react'
import {
  BlockNew,
  PageLayout,
  Page,
  TelegramBackButton,
  Text,
  TelegramMainButton,
} from '@components'
import {useChannelQuery, useCreateDealMutation} from '@store-new'
import {useTelegramUser} from '@hooks'
import styles from './RequestPostPage.module.scss'

export const RequestPostPage = () => {
  const {id} = useParams<{ id: string }>()
  const navigate = useNavigate()
  const channelId = id ? parseInt(id) : 0

  const {data: channel} = useChannelQuery(channelId);
  console.log(channel);
  const createDealMutation = useCreateDealMutation()
  const telegramUser = useTelegramUser()
  const userId = telegramUser?.id

  const [publishDate, setPublishDate] = useState('')
  const [messageText, setMessageText] = useState('')

  // Convert publishDate to ISO string format for API
  const formatPublishDate = (dateString: string): string | undefined => {
    if (!dateString) return undefined
    // Convert datetime-local format to ISO string
    return new Date(dateString).toISOString()
  }

  const postPricing = channel?.pricing?.find((p) => p.ad_format === 'post')

  const handleSubmit = async () => {
    if (!userId || !postPricing || !channel) {
      return
    }

    if (!messageText.trim()) {
      // Show error or prevent submission
      return
    }

    try {
      const deal = await createDealMutation.mutateAsync({
        deal_type: 'listing',
        channel_id: channel.id,
        channel_owner_id: channel.owner_id,
        advertiser_id: userId,
        ad_format: 'post',
        price_ton: postPricing.price_ton,
        publish_date: formatPublishDate(publishDate),
        postText: messageText,
      })

      // Navigate to deal details page
      navigate(`/marketplace/deals/${deal.id}`)
    } catch (error) {
      console.error('Failed to create deal:', error)
      // Error handling can be improved with toast notifications
    }
  }

  if (!channel) {
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

  return (
    <Page back>
      <PageLayout>
        <TelegramBackButton/>
        <BlockNew gap={16} className={styles.container}>
          <BlockNew padding="0 16px">
            <Text type="hero" weight="bold">
              Request Post
            </Text>
            <Text type="caption" color="secondary">
              Channel: {channel.title || `@${channel.username || 'channel'}`}
            </Text>
          </BlockNew>

          <BlockNew gap={12} padding="0 16px">
            <BlockNew gap={4}>
              <Text type="text" weight="medium">
                Publish Date (Optional)
              </Text>
              <input
                type="datetime-local"
                value={publishDate}
                onChange={(e) => setPublishDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-background-secondary)',
                  color: 'var(--color-text-primary)',
                  fontSize: '16px',
                }}
              />
            </BlockNew>
            <BlockNew gap={4}>
              <BlockNew row gap={4} align="center">
                <Text type="text" weight="medium">
                  Message Text
                </Text>
                <Text type="caption" color="danger">
                  *
                </Text>
              </BlockNew>
              <textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Enter your post message or brief..."
                rows={8}
                required
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: messageText.trim() === '' ? '1px solid var(--color-danger)' : '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-background-secondary)',
                  color: 'var(--color-text-primary)',
                  fontSize: '16px',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
            </BlockNew>
          </BlockNew>
        </BlockNew>
      </PageLayout>

      <TelegramMainButton
        text={createDealMutation.isPending ? 'Creating...' : 'Submit Request'}
        onClick={handleSubmit}
        disabled={createDealMutation.isPending || !userId || !messageText.trim()}
        loading={createDealMutation.isPending}
        isVisible={true}
      />
    </Page>
  )
}
