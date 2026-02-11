import {useEffect, useState} from 'react'
import {useNavigate} from 'react-router-dom'
import {
  AppSelect,
  BlockNew,
  Button,
  Icon,
  ListInput,
  Page,
  PageLayout,
  Spinner,
  TelegramBackButton,
  TelegramMainButton,
  Text,
  useToast,
  DebouncedListInput,
  Block,
  ListItem,
  List,
} from '@components'
import {useCreateChannelMutation, useValidateChannelMutation,} from '@store-new'
import {addBotToChannelLink, getBotToChannelLink} from '@utils'
import {useClipboard} from '@hooks'
import config from '@config'
import {PREDEFINED_TOPICS} from '../../../../common/constants/topics'

const topics = PREDEFINED_TOPICS.map((topic: { id: number; name: string }) => ({
  name: topic.name,
  value: topic.id.toString(),
}));

const MIN_USERNAME_LENGTH = 4;
export const AddChannelPage = () => {
  const navigate = useNavigate()
  const {showToast} = useToast()
  const [username, setUsername] = useState('')
  const [priceTon, setPriceTon] = useState('')
  const [topicId, setTopicId] = useState<number | undefined>(undefined)
  const [botAdded, setBotAdded] = useState(false)
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)

  const createChannelMutation = useCreateChannelMutation()
  const validateChannelMutation = useValidateChannelMutation()
  const {copy} = useClipboard()

  const handleAddBot = () => {
    addBotToChannelLink(config.botName);
    setBotAdded(true)
  }

  const handleCopyBotLink = () => {
    const botLink = getBotToChannelLink(config.botName)
    copy(botLink, 'Bot link copied to clipboard!')
  }

  const handleValidateChannel = async () => {
    if (validateChannelMutation.isPending || username.length < MIN_USERNAME_LENGTH) {
      return;
    }
    if (!username.trim()) {
      showToast({
        message: 'Please enter channel username first',
        type: 'warning',
      })
      return
    }

    try {
      const result = await validateChannelMutation.mutateAsync(username.trim())
      setIsAdmin(result.isAdmin);
    } catch (error: any) {
      console.error('Failed to validate channel:', error)
      showToast({
        message: error?.message || 'Failed to validate channel',
        type: 'error',
      })
      setIsAdmin(null)
    }
  }

  useEffect(() => {
    if (!username.trim() || validateChannelMutation.isPending) {
      return;
    }
    void handleValidateChannel();
  }, [username]);

  const handleSubmit = async () => {
    if (!username.trim()) {
      showToast({
        message: 'Please enter channel username',
        type: 'warning',
      })
      return;
    }

    if (!priceTon.trim()) {
      showToast({
        message: 'Please enter price in USDT',
        type: 'warning',
      })
      return;
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
  // const [isTopicDropdownOpen, setIsTopicDropdownOpen] = useState(false);
  // const topicButtonRef = useRef<HTMLDivElement>(null)
  //
  // const handleToggleTopicDropdown = (value?: boolean) => {
  //   setIsTopicDropdownOpen(value !== undefined ? value : !isTopicDropdownOpen);
  // }


  // const selectedTopicLabel = topicId
  //   ? PREDEFINED_TOPICS.find((t) => t.id === topicId)?.name || 'Select topic'
  //   : 'Any Topics'

  return (
    <Page back>
      <PageLayout>
        <TelegramBackButton/>

        <TelegramMainButton
          text={isLoading ? 'Adding Channel...' : 'Add Channel'}
          onClick={handleSubmit}
          disabled={!username.trim() || !priceTon.trim() || isLoading || !isAdmin}
          loading={isLoading}
          isVisible={true}
        />

        <BlockNew gap={16}>
          <Block margin="top">
            <Text type="title" weight="bold" align="center">
              Add Channel
            </Text>
            <Text type="caption" color='primary' align="center">
              Add your Telegram channel to the marketplace
            </Text>
          </Block>

          <Block margin="top" marginValue={4}>
            <List footer="Channel Username">
              <ListItem
                padding='2px 16px 2px 0px'
                after={validateChannelMutation.isPending ? <Spinner size={16}/> : isAdmin ?
                  <Icon name='verified' size={16}/> : undefined}
                disabled={validateChannelMutation.isPending}
              >
                <DebouncedListInput
                  value={username}
                  onChange={setUsername}
                  delay={1000}
                  placeholder="Enter Channel Name"
                  type="text"
                />
              </ListItem>
              {isAdmin === false && !validateChannelMutation.isPending && username.length >= MIN_USERNAME_LENGTH && (
                <ListItem
                  description={
                    <Text type="caption" color="tertiary">
                      Add the bot as an administrator to your channel with permission to post messages and stories.
                    </Text>
                  }
                >
                  <BlockNew row gap={8} align="center">
                    <Button
                      prefix={<Icon name="plus" color="primary" size={16}/>}
                      type='primary'
                      size="small"
                      onClick={handleAddBot}
                    >
                      Add {config.botName} as Admin
                    </Button>
                    <Button
                      type="secondary"
                      size="small"
                      onClick={handleCopyBotLink}
                    >
                      Copy Link
                    </Button>
                  </BlockNew>
                  {botAdded && (
                    <BlockNew margin="top" marginValue={4}>
                      <Text type="caption" color="accent">
                        ✓ Bot added. Please confirm in Telegram.
                      </Text>
                    </BlockNew>
                  )}
                </ListItem>
              )}
            </List>
          </Block>
          <Block margin="top" marginValue={4}>
            <List footer="Set the price for posting ads in your channel">
              <ListItem
                padding='2px 16px'
                text="Post Price (USDT)"
                after={
                  <ListInput
                    type="number"
                    pattern="[0-9]*"
                    inputMode="numeric"
                    textColor="tertiary"
                    value={priceTon}
                    onChange={setPriceTon}
                  />
                }
              >
              </ListItem>
            </List>
          </Block>

          <Block margin="top" marginValue={4}>
            <ListItem
              padding='8px 16px'
              text="Channel Topic"
              after={
                <AppSelect
                  options={topics}
                  value={topicId?.toString() || null}
                  onChange={(value) => setTopicId(value ? parseInt(value) : undefined)}
                  placeholder="Select a topic"
                />
              }
            >
            </ListItem>
          </Block>
        </BlockNew>
      </PageLayout>
    </Page>
  )
}
