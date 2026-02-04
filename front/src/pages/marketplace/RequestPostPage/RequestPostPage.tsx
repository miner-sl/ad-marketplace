import {useParams, useNavigate} from 'react-router-dom'
import {useState} from 'react'
import {
  Block,
  BlockNew,
  PageLayout,
  Page,
  TelegramBackButton,
  Text,
  TelegramMainButton,
  ChannelLink,
  useToast,
  List,
  ListItem,
} from '@components'
import {useChannelQuery, useCreateDealMutation} from '@store-new'
import {useTelegramUser} from '@hooks'
import styles from './RequestPostPage.module.scss'

export const RequestPostPage = () => {
  const {id} = useParams<{ id: string }>()
  const navigate = useNavigate()
  const channelId = id ? parseInt(id) : 0

  const {data: channel} = useChannelQuery(channelId);
  const createDealMutation = useCreateDealMutation()
  const telegramUser = useTelegramUser()
  const userId = telegramUser?.id
  const { showToast } = useToast()

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
        pricing_id: postPricing.id,
        advertiser_id: userId,
        publish_date: formatPublishDate(publishDate),
        postText: messageText,
      })
      showToast({
        message: 'Deal created successfully',
        type: 'success',
      })

      // Navigate to deal details page
      navigate(`/marketplace/deals/${deal.id}`)
    } catch (error) {
      console.error(error);
      showToast({
        message: error instanceof Error ? error.message : 'Failed to create deal',
        type: 'error',
      })
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
        <BlockNew padding="0 16px">
          <Text type="title" weight="bold">
            Request Post
          </Text>
          <ChannelLink channel={channel} showLabel={false} />
        </BlockNew>

        <Block margin="top" marginValue={24}>
          <List>
            <ListItem
              text="Publish Date"
              after={
                <input
                  type="datetime-local"
                  value={publishDate}
                  onChange={(e) => setPublishDate(e.target.value)}
                  className={styles.dateInput}
                />
              }
            />
          </List>
        </Block>

        <Block margin="top" marginValue={24}>
          <List>
            <ListItem
              text={
                <Block row gap={4} align="center">
                  <Text type="text">Message Text</Text>
                  <Text type="caption" color="danger">
                    *
                  </Text>
                </Block>
              }
            >
              <textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Enter your post message or brief..."
                rows={8}
                required
                className={styles.textarea}
                style={{
                  borderColor: messageText.trim() === '' ? 'var(--color-danger)' : undefined,
                }}
              />
            </ListItem>
          </List>
        </Block>
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
