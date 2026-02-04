import {useParams, useNavigate} from 'react-router-dom'
import {useState, useEffect} from 'react'
import {
  BlockNew,
  PageLayout,
  Page,
  TelegramBackButton,
  Text,
  TelegramMainButton,
  ChannelLink,
  ListInput,
  ListToggler,
  Button,
  useToast,
} from '@components'
import {useChannelQuery, useChannelStatsQuery, useSetChannelPricingMutation} from '@store-new'
import {useTelegramUser} from '@hooks'
import {useAuth} from '@context'
import {ROUTES_NAME} from '@routes'
import type {AdFormat} from '@types'
import styles from './ChannelDetailsPage.module.scss'
import {separateNumber} from '@utils'

const AD_FORMATS: { value: AdFormat; label: string }[] = [
  { value: 'post', label: 'Post' },
  { value: 'forward', label: 'Forward/Repost' },
  { value: 'story', label: 'Story' },
]

export const ChannelDetailsPage = () => {
  const {id} = useParams<{ id: string }>()
  const navigate = useNavigate()
  const channelId = id ? parseInt(id) : 0
  const {showToast} = useToast()

  const {data: channel, isLoading} = useChannelQuery(channelId)
  const {data: stats} = useChannelStatsQuery(channelId)
  const telegramUser = useTelegramUser()
  const userId = telegramUser?.id
  const {user} = useAuth()
  const setPricingMutation = useSetChannelPricingMutation()

  // Check if current user is the channel owner
  const isChannelOwner = user && channel && user.id === channel.owner_id

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false)

  // Local state for editing prices (only for channel owner)
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

  // Initialize prices from channel data when entering edit mode
  useEffect(() => {
    if (channel?.pricing && isEditing) {
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
  }, [channel?.pricing, isEditing])

  const handleEditToggle = () => {
    if (isEditing) {
      // Exiting edit mode - data is already saved via onBlur and toggle handlers
      setIsEditing(false)
    } else {
      // Entering edit mode - initialize with current values
      setIsEditing(true)
    }
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

  const displayStats = stats || channel.stats
  // For non-owners, only show active pricing
  const visiblePricing = isChannelOwner
    ? channel.pricing
    : channel.pricing?.filter((p) => p.is_active)

  // Find active post pricing for "Request Post" button
  const postPricing = channel.pricing?.find((p) => p.ad_format === 'post' && p.is_active)

  const handleRequestPostClick = () => {
    navigate(ROUTES_NAME.MARKETPLACE_REQUEST_POST.replace(':id', id || ''))
  }

  const handlePriceChange = (format: AdFormat, value: string) => {
    // Allow empty string or valid number
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setEditingPrices((prev) => ({ ...prev, [format]: value }))
    }
  }

  const handleToggleEnabled = async (format: AdFormat) => {
    if (!isChannelOwner || !channel) return

    const currentPricing = channel.pricing?.find((p) => p.ad_format === format)
    const currentEnabled = isEditing ? priceEnabled[format] : currentPricing?.is_active ?? false
    const newEnabled = !currentEnabled

    // Get price value - use editing state if in edit mode, otherwise use current pricing
    const priceValue = isEditing
      ? editingPrices[format].trim()
      : currentPricing?.price_ton.toString() || ''

    // If enabling, require a valid price
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
        setPriceEnabled((prev) => ({ ...prev, [format]: newEnabled }))
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

    // Only save if price changed and is valid
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
        showToast({ type: 'success', message: 'Price updated' })
      } catch (error: any) {
        showToast({
          type: 'error',
          message: error?.message || 'Failed to update price',
        })
      }
    }
  }

  return (
    <Page back>
      <PageLayout>
        <TelegramBackButton/>
        <BlockNew gap={4} className={styles.container}>
          <BlockNew padding="0 8px">
            <BlockNew gap={4}>
              <ChannelLink channel={channel} showLabel={false} textType="title2" weight="bold" />
              {channel.is_verified && (
                <Text type="caption" color="accent">
                  ✓ Verified Channel
                </Text>
              )}
            </BlockNew>
          </BlockNew>

          {channel.description && (
            <BlockNew padding="0 8px">
              <Text type="text" color="secondary">
                {channel.description}
              </Text>
            </BlockNew>
          )}

          {displayStats && (
            <BlockNew gap={2} padding="0 8px">
              <BlockNew gap={2}>
                <Text type="title2" weight="bold">
                  Statistics
                </Text>
                {displayStats.subscribers_count && (
                  <Text type="text">
                    👥 {separateNumber(displayStats.subscribers_count)} subscribers
                  </Text>
                )}
                {displayStats.average_views && (
                  <Text type="text">
                    👁️ {separateNumber(displayStats.average_views)} average views
                  </Text>
                )}
                {displayStats.average_reach && (
                  <Text type="text">
                    📊 {separateNumber(displayStats.average_reach)} average reach
                  </Text>
                )}
                {displayStats.premium_subscribers_count && (
                  <Text type="text" color="accent">
                    ⭐ {separateNumber(displayStats.premium_subscribers_count)}{' '}
                    premium subscribers
                  </Text>
                )}
              </BlockNew>
            </BlockNew>
          )}

          <BlockNew gap={2} padding="0 8px">
            <BlockNew row gap={8} justify="between" align="center">
              <Text type="title2" weight="bold">
                Pricing
              </Text>
              {isChannelOwner && (
                <Button
                  type={isEditing ? 'secondary' : 'basic'}
                  onClick={handleEditToggle}
                >
                  {isEditing ? 'Done' : 'Edit'}
                </Button>
              )}
            </BlockNew>
            {AD_FORMATS.map((format) => {
              const pricing = channel.pricing?.find((p) => p.ad_format === format.value)
              const isEnabled = isChannelOwner && isEditing
                ? priceEnabled[format.value]
                : pricing?.is_active ?? false

              // For non-owners, only show if active
              // For owners, show all formats (they can enable/disable)
              if (!isChannelOwner && !isEnabled) {
                return null
              }

              return (
                <BlockNew key={format.value} gap={8} row align="center" className={styles.pricingRow}>
                  <BlockNew row gap={8} align="center" style={{ flex: 1 }}>
                    <Text type="text" weight="medium" style={{ minWidth: '100px' }}>
                      {format.label}
                    </Text>
                    {isChannelOwner && isEditing ? (
                      <>
                        <ListInput
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={editingPrices[format.value]}
                          onChange={(value) => handlePriceChange(format.value, value)}
                          onBlur={() => handlePriceBlur(format.value)}
                          disabled={setPricingMutation.isPending}
                          className={styles.priceInput}
                        />
                        <Text type="text" color="secondary">
                          TON
                        </Text>
                      </>
                    ) : (
                      <Text type="text" color={isEnabled ? 'accent' : 'secondary'}>
                        {pricing?.price_ton || '0.00'} TON
                      </Text>
                    )}
                  </BlockNew>
                  {isChannelOwner && (
                    <ListToggler
                      isEnabled={isEnabled}
                      onChange={() => handleToggleEnabled(format.value)}
                      disabled={setPricingMutation.isPending}
                    />
                  )}
                </BlockNew>
              )
            })}
            {(!isChannelOwner || !isEditing) && (!visiblePricing || visiblePricing.length === 0) && (
              <Text type="text" color="secondary">
                No pricing available
              </Text>
            )}
          </BlockNew>

          {postPricing && userId && (
            <TelegramMainButton
              text="Request Post"
              onClick={handleRequestPostClick}
              isVisible={true}
            />
          )}
        </BlockNew>
      </PageLayout>
    </Page>
  )
}
