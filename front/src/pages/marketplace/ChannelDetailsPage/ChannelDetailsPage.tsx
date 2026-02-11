import {useNavigate, useParams} from 'react-router-dom'
import {useEffect, useState} from 'react'
import {openTelegramLink} from '@tma.js/sdk-react'
import {
  AppSelect,
  Block,
  BlockNew,
  Button,
  Group,
  Icon,
  Image,
  List,
  ListInput,
  ListItem,
  ListToggler,
  Page,
  PageLayout,
  Spinner,
  TelegramBackButton,
  TelegramMainButton,
  Text,
  useToast,
} from '@components'

import {useChannelQuery, useSetChannelPricingMutation, useUpdateChannelMutation} from '@store-new'
import {useClipboard, useTelegramUser} from '@hooks'
import {useAuth} from '@context'
import {ROUTES_NAME} from '@routes'
import type {AdFormat, Channel, ChannelStats} from '@types'
import {checkIsMobile, createMembersCount, getChannelLink, hapticFeedback, separateNumber} from '@utils'
import {PREDEFINED_TOPICS} from "../../../common/constants/topics";

import styles from './ChannelDetailsPage.module.scss'

interface ChannelHeaderProps {
  channel: Channel
  stats?: ChannelStats
}

const ChannelHeader = ({channel, stats}: ChannelHeaderProps) => {
  const subscribersCount = stats?.subscribers_count || 0

  return (
    <>
      <Block align="center">
        <Image
          size={112}
          src={null}
          borderRadius={50}
          fallback={channel.title}
        />
      </Block>
      <Block margin="top" marginValue={12} row justify="center" align="center" gap={4}>
        <Text type="title2" align="center" weight="bold">
          {channel.title}
        </Text>
        {channel.is_verified && (
          <Icon name="verified" size={20}/>
        )}
      </Block>

      {subscribersCount > 0 && (
        <Block margin="top" marginValue={8}>
          <Text type="caption2" color="tertiary" align="center">
            {createMembersCount(subscribersCount)}
          </Text>
        </Block>
      )}
      {channel.description && (
        <Block margin="top" marginValue={8}>
          <Text type="text" align="center" color="tertiary">
            {channel.description}
          </Text>
        </Block>
      )}
    </>
  )
}

const AD_FORMATS: { value: AdFormat; label: string }[] = [
  {value: 'post', label: 'Post'},
  // { value: 'forward', label: 'Forward/Repost' },
  // { value: 'story', label: 'Story' },
]

export const ChannelDetailsPage = () => {
  const {id} = useParams<{ id: string }>()
  const navigate = useNavigate()
  const channelId = id ? parseInt(id) : 0
  const {showToast} = useToast()

  const {data: channel, isLoading} = useChannelQuery(channelId)
  // const {data: stats} = useChannelStatsQuery(channelId)
  const telegramUser = useTelegramUser()
  const userId = telegramUser?.id
  const {user} = useAuth()
  const setPricingMutation = useSetChannelPricingMutation()
  // const updateChannelStatusMutation = useUpdateChannelStatusMutation()
  const updateChannelMutation = useUpdateChannelMutation()
  const {copy} = useClipboard()

  const isChannelOwner = user && channel && user.id === channel.owner_id

  const [isEditing, setIsEditing] = useState(false)
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null)

  useEffect(() => {
    if (channel?.topic_id !== undefined) {
      setSelectedTopicId(channel.topic_id)
    }
  }, [channel?.topic_id])

  const [editingPrices, setEditingPrices] = useState<Record<AdFormat, string>>({
    post: '',
    forward: '',
    story: '',
  })
  const [priceEnabled, setPriceEnabled] = useState<Record<AdFormat, boolean>>({
    post: false,
    forward: false,
    story: false,
  })

  const [editingActiveStatus, setEditingActiveStatus] = useState<boolean>(false)

  useEffect(() => {
    if (channel && isEditing) {
      if (channel.pricing) {
        const initialPrices: Record<AdFormat, string> = {
          post: '',
          forward: '',
          story: '',
        }
        const initialEnabled: Record<AdFormat, boolean> = {
          post: false,
          forward: false,
          story: false,
        }

        channel.pricing.forEach((pricing) => {
          if (pricing.ad_format in initialPrices) {
            const format = pricing.ad_format as AdFormat
            initialPrices[format] = pricing.price_ton.toString()
            initialEnabled[format] = pricing.is_active
          }
        })

        setEditingPrices(initialPrices)
        setPriceEnabled(initialEnabled)
      }

      // Initialize active status
      setEditingActiveStatus(channel.is_active)
    }
  }, [channel, isEditing])

  const handleEditToggle = async () => {
    if (isEditing) {
      try {
        const updates: { active?: boolean; price?: number; topic?: number | null } = {}

        const currentTopicId = channel?.topic_id ?? null
        if (selectedTopicId !== currentTopicId) {
          updates.topic = selectedTopicId
        }

        const postPrice = editingPrices.post.trim()
        const currentPostPricing = channel?.pricing?.find((p) => p.ad_format === 'post')
        const PRICE_THRESHOLD = 0.001 // Threshold for comparing floating point numbers

        if (postPrice && !isNaN(parseFloat(postPrice)) && parseFloat(postPrice) > 0) {
          const newPrice = parseFloat(postPrice)
          const currentPrice = currentPostPricing?.price_ton ?? 0
          const priceDiff = Math.abs(newPrice - currentPrice)

          // Only update if the difference is significant (greater than threshold)
          if (!currentPostPricing || priceDiff >= PRICE_THRESHOLD) {
            updates.price = newPrice
          }
        }

        if (channel && editingActiveStatus !== channel.is_active) {
          updates.active = editingActiveStatus
        }

        // Only call API if there are actual changes
        if (Object.keys(updates).length > 0) {
          await updateChannelMutation.mutateAsync({
            id: channel!.id,
            data: updates,
          })
          showToast({type: 'success', message: 'Channel updated successfully'})
        }

        setIsEditing(false)
      } catch (error: any) {
        showToast({
          type: 'error',
          message: error?.message || 'Failed to save changes',
        })
      }
    } else {
      // Initialize topic when entering edit mode
      if (channel?.topic_id !== undefined) {
        setSelectedTopicId(channel.topic_id)
      } else {
        setSelectedTopicId(null)
      }
      setIsEditing(true)
    }
  }

  const handleTopicChange = (topicId: string) => {
    const id = topicId === '' ? null : parseInt(topicId)
    setSelectedTopicId(id)
  }

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

  const displayStats = channel.stats
  const visiblePricing = isChannelOwner
    ? channel.pricing
    : channel.pricing?.filter((p) => p.is_active)

  const postPricing = channel.pricing?.find((p) => p.ad_format === 'post' && p.is_active)

  const handleRequestPostClick = () => {
    navigate(ROUTES_NAME.MARKETPLACE_REQUEST_POST.replace(':id', id || ''))
  }

  const handleShareLink = () => {
    hapticFeedback('soft')

    const channelLink = getChannelLink(channel)
    if (!channelLink) {
      showToast({
        type: 'error',
        message: 'Channel link not available',
      })
      return
    }

    const {isMobile} = checkIsMobile()
    if (isMobile) {
      openTelegramLink(
        `https://t.me/share/url?url=${encodeURI(channelLink)}&text=${channel.title || 'Check out this channel'}`
      )
    } else {
      copy(channelLink, 'Link copied!')
    }
  }

  const handleCopyLink = () => {
    const channelLink = getChannelLink(channel)
    if (!channelLink) {
      showToast({
        type: 'error',
        message: 'Channel link not available',
      })
      return
    }
    copy(channelLink, 'Link copied')
  }


  const handlePriceChange = (format: AdFormat, value: string) => {
    // Allow empty string or valid number
    // Remove any trailing zeros after decimal point for better UX while typing
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setEditingPrices((prev) => ({...prev, [format]: value}))
    }
  }

  const handleToggleEnabled = async (format: AdFormat) => {
    if (!isChannelOwner || !channel) return

    const currentPricing = channel.pricing?.find((p) => p.ad_format === format)
    const currentEnabled = isEditing ? priceEnabled[format] : currentPricing?.is_active ?? false
    const newEnabled = !currentEnabled

    const priceValue = isEditing
      ? editingPrices[format].trim()
      : currentPricing?.price_ton?.toString?.() || ''

    if (newEnabled) {
      if (!priceValue || isNaN(parseFloat(priceValue)) || parseFloat(priceValue) <= 0) {
        showToast({
          type: 'error',
          message: isEditing
            ? 'Please enter a valid price first'
            : 'Please set a price in edit mode first'
        })
        return
      }
    }

    try {
      const priceToSave = parseFloat(priceValue) || currentPricing?.price_ton || 0

      await setPricingMutation.mutateAsync({
        channel_id: channel.id,
        ad_format: format,
        price_ton: priceToSave,
        is_active: newEnabled,
      })

      // Update local state if in edit mode
      if (isEditing) {
        setPriceEnabled((prev) => ({...prev, [format]: newEnabled}))
      }

      showToast({
        type: 'success',
        message: `${AD_FORMATS.find((f) => f.value === format)?.label} ${newEnabled ? 'enabled' : 'disabled'}`
      })
    } catch (error: any) {
      showToast({
        type: 'error',
        message: error?.message || 'Failed to update pricing',
      })
    }
  }

  const handlePriceBlur = async (format: AdFormat) => {
    if (!isChannelOwner || !channel) return

    const priceValue = editingPrices[format].trim()
    const currentPricing = channel.pricing?.find((p) => p.ad_format === format)

    if (priceValue && !isNaN(parseFloat(priceValue))) {
      const formattedValue = parseFloat(priceValue).toFixed(2)
      setEditingPrices((prev) => ({...prev, [format]: formattedValue}))
    }

    if (
      priceValue &&
      !isNaN(parseFloat(priceValue)) &&
      parseFloat(priceValue) > 0 &&
      (!currentPricing || currentPricing.price_ton.toString() !== priceValue)
    ) {
      try {
        await setPricingMutation.mutateAsync({
          channel_id: channel.id,
          ad_format: format,
          price_ton: parseFloat(priceValue),
          is_active: priceEnabled[format],
        })
        showToast({type: 'success', message: 'Price updated'})
      } catch (error: any) {
        showToast({
          type: 'error',
          message: error?.message || 'Failed to update price',
        })
      }
    }
  }

  const handleActiveOrDeactivateChannel = (isEnabled: boolean) => {
    // Only update local state in edit mode, actual save happens on "Done"
    if (isEditing) {
      setEditingActiveStatus(isEnabled)
    }
  };

  return (
    <Page back>
      <PageLayout>
        <TelegramBackButton/>

        <ChannelHeader channel={channel} stats={displayStats}/>

        <Block
          margin="top"
          marginValue={24}
          row
          justify="between"
          align="center"
          gap={10}
        >
          <div style={{flex: 1}}>
            <Button
              type="primary"
              prefix={<Icon name="share" color="primary" size={24}/>}
              onClick={handleShareLink}
            >
              Share
            </Button>
          </div>
          <div style={{flex: 1}}>
            <Button type="accent" onClick={handleCopyLink}>
              Copy Link
            </Button>
          </div>
        </Block>

        {displayStats && (
          <Block margin="bottom" marginValue={24}>
            <Block paddingValue={16}>
              <Group header="STATISTICS">
                {displayStats.subscribers_count && (
                  <ListItem
                    text={
                      <Text type="text">
                        👥 {separateNumber(displayStats.subscribers_count)} subscribers
                      </Text>
                    }
                  />
                )}
                {displayStats.average_views && (
                  <ListItem
                    text={
                      <Text type="text">
                        👁️ {separateNumber(displayStats.average_views)} average views
                      </Text>
                    }
                  />
                )}
                {displayStats.average_reach && (
                  <ListItem
                    text={
                      <Text type="text">
                        📊 {separateNumber(displayStats.average_reach)} average reach
                      </Text>
                    }
                  />
                )}
                {displayStats.premium_subscribers_count && (
                  <ListItem
                    text={
                      <Text type="text" color="accent">
                        ⭐ {separateNumber(displayStats.premium_subscribers_count)} premium subscribers
                      </Text>
                    }
                  />
                )}
              </Group>
            </Block>
          </Block>
        )}

        {isChannelOwner && (
          <Block margin="top" marginValue={24}>
            <Group header="CHANNEL STATUS">
              <ListItem
                disabled={updateChannelMutation.isPending}
                text={
                  <Text type="text"
                        color={isEditing ? (editingActiveStatus ? 'accent' : 'secondary') : (channel.is_active ? 'accent' : 'secondary')}>
                    {isEditing
                      ? (editingActiveStatus ? 'Channel Active' : 'Channel Inactive')
                      : (channel.is_active ? 'Channel Active' : 'Channel Inactive')
                    }
                  </Text>
                }
                description={
                  <Text type="caption" color="tertiary">
                    {(channel.is_active || editingActiveStatus
                      ? 'Channel is visible in the marketplace'
                      : 'Channel is hidden from the marketplace')
                    }
                  </Text>
                }
                after={
                  updateChannelMutation.isPending ? (
                    <Spinner size={16}/>
                  ) : isEditing ? (
                    <ListToggler
                      isEnabled={editingActiveStatus}
                      onChange={handleActiveOrDeactivateChannel}
                      disabled={updateChannelMutation.isPending}
                    />
                  ) : (
                    <Text type="text" color="secondary">
                      {channel.is_active ? 'Active' : 'Inactive'}
                    </Text>
                  )
                }
              />
            </Group>
          </Block>
        )}

        <Block margin="top" marginValue={24}>
          <Block margin="bottom" marginValue={44}>
            <List header="CONFIGURATION">
              <ListItem
                text={
                  <BlockNew row align="center" justify="between" gap={8}>
                    <Text type="text" weight="medium">
                      Topic
                    </Text>
                    {isChannelOwner && isEditing ? (
                      <AppSelect
                        options={[
                          {value: '', name: 'No topic'},
                          ...PREDEFINED_TOPICS.map((topic) => ({
                            value: topic.id.toString(),
                            name: topic.name,
                          })),
                        ]}
                        value={selectedTopicId?.toString() || ''}
                        onChange={handleTopicChange}
                        placeholder="Select topic"
                        disabled={updateChannelMutation.isPending}
                      />
                    ) : (
                      <Text type="text" color={channel.topic_id ? 'primary' : 'secondary'}>
                        {channel.topic_id
                          ? PREDEFINED_TOPICS.find((t) => t.id === channel.topic_id)?.name || 'Unknown'
                          : 'No topic'}
                      </Text>
                    )}
                  </BlockNew>
                }
              />
              {(() => {
                const format = AD_FORMATS.find((f) => f.value === 'post')
                if (!format) return null

                const pricing = channel.pricing?.find((p) => p.ad_format === format.value)
                const isEnabled = isChannelOwner && isEditing
                  ? priceEnabled[format.value]
                  : pricing?.is_active ?? false

                if (!isChannelOwner && !isEnabled) {
                  return null
                }

                return (
                  <ListItem
                    key={format.value}
                    disabled={setPricingMutation.isPending}
                    text={
                      <BlockNew row align="center" justify="between" gap={8} className={styles.priceTextContainer}>
                        {isChannelOwner && isEditing ? (
                          <>
                            <div className={styles.priceLabel}>
                              <Text type="text" weight="medium">
                                {format.label}
                              </Text>
                            </div>
                            <Block row justify="end" align="center">
                              <ListInput
                                type="number"
                                inputMode="decimal"
                                step="0.01"
                                min="0"
                                placeholder="0.00"
                                value={
                                  editingPrices[format.value]
                                    ? (() => {
                                      const val = editingPrices[format.value]
                                      if (val && !val.endsWith('.') && !isNaN(parseFloat(val))) {
                                        return parseFloat(val).toFixed(2)
                                      }
                                      return val
                                    })()
                                    : ''
                                }
                                onChange={(value) => handlePriceChange(format.value, value)}
                                onBlur={() => handlePriceBlur(format.value)}
                                disabled={setPricingMutation.isPending}
                                className={styles.priceInput}
                              />
                              <Text type="text" color="secondary">
                                USDT
                              </Text>
                            </Block>
                          </>
                        ) : (
                          <>
                            <div className={styles.priceLabel}>
                              <Text type="text" weight="medium">
                                {format.label}
                              </Text>
                            </div>
                            <Text type="text" color={isEnabled ? 'accent' : 'secondary'}>
                              {postPricing?.price_ton !== undefined ? postPricing?.price_ton : '-'} USDT
                            </Text>
                          </>
                        )}
                      </BlockNew>
                    }
                    after={
                      <>
                        {setPricingMutation.isPending && <Spinner size={16}/>}
                      </>
                    }
                    before={
                      <div
                        onClick={(e) => {
                          if (isChannelOwner && !setPricingMutation.isPending) {
                            e.stopPropagation()
                            handleToggleEnabled(format.value)
                          }
                        }}
                        style={{
                          cursor: isChannelOwner && !setPricingMutation.isPending ? 'pointer' : 'default',
                          opacity: setPricingMutation.isPending ? 0.5 : 1,
                        }}
                      >
                        <Icon
                          name={isEnabled ? 'eye' : 'eyeCrossed'}
                          size={28}
                          color={isEnabled ? 'tertiary' : 'primary'}
                        />
                      </div>
                    }
                  />
                )
              })()}
              {(!isChannelOwner || !isEditing) && (!visiblePricing || visiblePricing.length === 0) && (
                <ListItem
                  text={
                    <Text type="text" color="secondary">
                      No pricing available
                    </Text>
                  }
                />
              )}
            </List>
          </Block>
        </Block>


        {!isChannelOwner && (
          <Block margin="top" marginValue="auto">
            <Text type="caption" align="center" color="tertiary">
              To request a post from {channel.title || 'this channel'},
              <br/>
              click the button below
            </Text>
          </Block>
        )}

        {!isChannelOwner && postPricing && userId && (
          <TelegramMainButton
            text="Request Post"
            onClick={handleRequestPostClick}
            isVisible={true}
          />
        )}

        {isChannelOwner && (
          <TelegramMainButton
            text={isEditing ? (updateChannelMutation.isPending ? 'Saving...' : 'Done') : 'Edit'}
            onClick={handleEditToggle}
            isVisible={true}
            disabled={updateChannelMutation.isPending}
            loading={updateChannelMutation.isPending}
          />
        )}
      </PageLayout>
    </Page>
  )
}
