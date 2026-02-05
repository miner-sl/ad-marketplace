import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BlockNew,
  PageLayout,
  Page,
  TelegramBackButton,
  TelegramMainButton,
  Text,
  ListInput,
  useToast,
  Icon,
  AppSelect,
  Button,
} from '@components'
import {
  useCreateChannelMutation,
  useValidateChannelMutation,
} from '@store-new'
import { addBotToChannelLink, getBotToChannelLink } from '@utils'
import { useThrottle, useClipboard } from '@hooks'
// import { PREDEFINED_TOPICS } from '@common/constants/topics'
import config from '@config'
import { PREDEFINED_TOPICS } from '../../../../common/constants/topics'

import styles from './AddChannelPage.module.scss'

export const AddChannelPage = () => {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [username, setUsername] = useState('')
  const [priceTon, setPriceTon] = useState('')
  const [topicId, setTopicId] = useState<number | undefined>(undefined)
  const [botAdded, setBotAdded] = useState(false)
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)

  const createChannelMutation = useCreateChannelMutation()
  const validateChannelMutation = useValidateChannelMutation()
  const { copy } = useClipboard()

  const handleAddBot = () => {
    addBotToChannelLink(config.botName);
    setBotAdded(true)
  }

  const handleCopyBotLink = () => {
    const botLink = getBotToChannelLink(config.botName)
    copy(botLink, 'Bot link copied to clipboard!')
  }

  const handleValidateChannel = async () => {
    if (!username.trim()) {
      showToast({
        message: 'Please enter channel username first',
        type: 'warning',
      })
      return
    }

    try {
      const result = await validateChannelMutation.mutateAsync(username.trim())
      setIsAdmin(result.isAdmin)
      if (result.isAdmin) {
        showToast({
          message: 'Bot is admin of this channel!',
          type: 'success',
        })
      } else {
        showToast({
          message: 'Bot is not admin. Please add bot as admin first.',
          type: 'warning',
        })
      }
    } catch (error: any) {
      console.error('Failed to validate channel:', error)
      showToast({
        message: error?.message || 'Failed to validate channel',
        type: 'error',
      })
      setIsAdmin(null)
    }
  }

  const throttledValidate = useThrottle(handleValidateChannel, 2000)

  const handleSubmit = async () => {
    if (!username.trim()) {
      showToast({
        message: 'Please enter channel username',
        type: 'warning',
      })
      return
    }

    if (!priceTon.trim()) {
      showToast({
        message: 'Please enter price in TON',
        type: 'warning',
      })
      return
    }

    const price = parseFloat(priceTon.trim())
    if (isNaN(price) || price <= 0) {
      showToast({
        message: 'Please enter a valid price',
        type: 'warning',
      })
      return
    }

    try {
      await createChannelMutation.mutateAsync({
        username: username.trim(),
        price_ton: price,
        topic_id: topicId,
      })

      showToast({
        message: 'Channel added successfully!',
        type: 'success',
      })
      navigate('/mychannels')
    } catch (error: any) {
      console.error('Failed to add channel:', error)
      showToast({
        message: error?.message || 'Failed to add channel',
        type: 'error',
      })
    }
  }

  const isLoading = createChannelMutation.isPending

  return (
    <Page back>
      <PageLayout>
        <TelegramBackButton />
        <BlockNew gap={16} className={styles.container}>
          <BlockNew padding="0 16px">
            <Text type="title" weight="bold">
              Add Channel
            </Text>
            <Text type="caption" color="secondary">
              Add your Telegram channel to the marketplace
            </Text>
          </BlockNew>

          <BlockNew gap={16}>
            {/* Bot Admin Setup */}
            <BlockNew gap={8} className={styles.section}>
              <Text type="text" weight="bold">
                Step 1: Add Bot as Admin
              </Text>
              <Text type="caption" color="secondary">
                Add the bot as an administrator to your channel with permission to post messages and stories.
              </Text>
              <BlockNew row gap={8} align="center">
                <div
                  className={styles.botButton}
                  onClick={handleAddBot}
                >
                  <Icon name="plus" size={20} />
                  <Text type="text" weight="medium">
                    Add {config.botName} as Admin
                  </Text>
                </div>
                <Button
                  type="secondary"
                  size="small"
                  onClick={handleCopyBotLink}
                >
                  <Icon name="share" size={16} />
                  <span style={{ marginLeft: 4 }}>Copy Link</span>
                </Button>
              </BlockNew>
              {botAdded && (
                <BlockNew margin="top" marginValue={4}>
                  <Text type="caption" color="accent">
                    ✓ Bot added. Please confirm in Telegram.
                  </Text>
                </BlockNew>
              )}
              {username.trim() && (
                <BlockNew margin="top" marginValue={8}>
                  <Button
                    type="secondary"
                    size="small"
                    onClick={throttledValidate}
                    disabled={validateChannelMutation.isPending}
                  >
                    {validateChannelMutation.isPending ? 'Checking...' : 'Check Admin Status'}
                  </Button>
                  {isAdmin !== null && (
                    <BlockNew margin="top" marginValue={4}>
                      <Text type="caption" color={isAdmin ? 'accent' : 'danger'}>
                        {isAdmin ? '✓ Bot is admin' : '✗ Bot is not admin'}
                      </Text>
                    </BlockNew>
                  )}
                </BlockNew>
              )}
            </BlockNew>

            {/* Channel Information */}
            <BlockNew gap={12} className={styles.section}>
              <Text type="text" weight="bold">
                Step 2: Channel Information
              </Text>

              <BlockNew gap={4}>
                <Text type="text" weight="medium">
                  Channel Username *
                </Text>
                <Text type="caption" color="secondary">
                  Enter your Telegram channel username (without @)
                </Text>
                <ListInput
                  value={username}
                  onChange={setUsername}
                  placeholder="channelname"
                  type="text"
                />
              </BlockNew>

              <BlockNew gap={4}>
                <Text type="text" weight="medium">
                  Price (TON) *
                </Text>
                <Text type="caption" color="secondary">
                  Set the price for posting ads in your channel
                </Text>
                <ListInput
                  value={priceTon}
                  onChange={setPriceTon}
                  placeholder="0.0"
                  type="number"
                  step="0.1"
                />
              </BlockNew>

              <BlockNew gap={4}>
                <Text type="text" weight="medium">
                  Topic (optional)
                </Text>
                <Text type="caption" color="secondary">
                  Select a topic category for your channel
                </Text>
                <AppSelect
                  options={PREDEFINED_TOPICS.map((topic: { id: number; name: string }) => ({
                    value: topic.id.toString(),
                    name: topic.name,
                  }))}
                  value={topicId?.toString() || null}
                  onChange={(value) => setTopicId(value ? parseInt(value) : undefined)}
                  placeholder="Select a topic"
                />
              </BlockNew>
            </BlockNew>
          </BlockNew>

          <TelegramMainButton
            text={isLoading ? 'Adding Channel...' : 'Add Channel'}
            onClick={handleSubmit}
            disabled={!username.trim() || !priceTon.trim() || isLoading}
            loading={isLoading}
            isVisible={true}
          />
        </BlockNew>
      </PageLayout>
    </Page>
  )
}
