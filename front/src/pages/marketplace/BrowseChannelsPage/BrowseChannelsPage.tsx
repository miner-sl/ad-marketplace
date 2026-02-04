import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import {
  BlockNew,
  PageLayout,
  Page,
  TelegramBackButton,
  Text,
  Button,
  ListInput,
  Group,
  GroupItem,
  Image,
  Icon,
} from '@components'
import { useChannelsQuery } from '@store-new'
import { ROUTES_NAME } from '@routes'
import {pluralize, hapticFeedback} from '@utils'
import type { ChannelFilters, AdFormat } from '@types'
import styles from './BrowseChannelsPage.module.scss'

export const BrowseChannelsPage = () => {
  const navigate = useNavigate()
  const [filters, setFilters] = useState<ChannelFilters>({
    limit: 50,
  })
  const [showFilters, setShowFilters] = useState(false)

  const { data: channels, isLoading: channelsLoading } = useChannelsQuery(filters)

  const handleFilterChange = (key: keyof ChannelFilters, value: string) => {
    if (value === '') {
      setFilters((prev) => {
        const { [key]: _, ...rest } = prev
        return rest
      })
      return
    }
    const numValue = Number(value)
    if (!isNaN(numValue)) {
      setFilters((prev) => ({
        ...prev,
        [key]: numValue,
      }))
    }
  }

  const handleFormatChange = (value: string) => {
    setFilters((prev) => ({
      ...prev,
      ad_format: value === '' ? undefined : (value as AdFormat),
    }))
  }

  const resetFilters = () => {
    setFilters({ limit: 50 })
  }

  return (
    <Page back>
      <PageLayout>
        <TelegramBackButton />
        <BlockNew gap={16} className={styles.container}>
          <BlockNew padding="0 16px">
            <BlockNew row justify="between" align="center">
              <Text type="title2" weight="bold">
                Browse Channels
              </Text>
              <Button
                type="secondary"
                onClick={() => setShowFilters(!showFilters)}
              >
                {showFilters ? 'Hide Filters' : 'Filters'}
              </Button>
            </BlockNew>
          </BlockNew>

          {showFilters && (
            <BlockNew gap={12} padding="0 16px" className={styles.filters}>
              <BlockNew gap={8}>
                <Text type="caption" color="secondary">
                  Subscribers
                </Text>
                <BlockNew row gap={8}>
                  <ListInput
                    type="number"
                    placeholder="Min"
                    value={filters.min_subscribers?.toString() || ''}
                    onChange={(value) => handleFilterChange('min_subscribers', value)}
                    inputMode="numeric"
                  />
                  <ListInput
                    type="number"
                    placeholder="Max"
                    value={filters.max_subscribers?.toString() || ''}
                    onChange={(value) => handleFilterChange('max_subscribers', value)}
                    inputMode="numeric"
                  />
                </BlockNew>
              </BlockNew>

              <BlockNew gap={8}>
                <Text type="caption" color="secondary">
                  Price (TON)
                </Text>
                <BlockNew row gap={8}>
                  <ListInput
                    type="number"
                    placeholder="Min"
                    value={filters.min_price?.toString() || ''}
                    onChange={(value) => handleFilterChange('min_price', value)}
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                  />
                  <ListInput
                    type="number"
                    placeholder="Max"
                    value={filters.max_price?.toString() || ''}
                    onChange={(value) => handleFilterChange('max_price', value)}
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                  />
                </BlockNew>
              </BlockNew>

              <BlockNew gap={8}>
                <Text type="caption" color="secondary">
                  Average Views
                </Text>
                <ListInput
                  type="number"
                  placeholder="Minimum views"
                  value={filters.min_views?.toString() || ''}
                  onChange={(value) => handleFilterChange('min_views', value)}
                  inputMode="numeric"
                />
              </BlockNew>

              <BlockNew gap={8}>
                <Text type="caption" color="secondary">
                  Ad Format
                </Text>
                <select
                  value={filters.ad_format || ''}
                  onChange={(e) => handleFormatChange(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '12px',
                    border: '1px solid var(--color-backgroundTertiary)',
                    backgroundColor: 'var(--color-background)',
                    color: 'var(--color-textPrimary)',
                    fontSize: '16px',
                  }}
                >
                  <option value="">All formats</option>
                  <option value="post">Post</option>
                  <option value="forward">Forward</option>
                  <option value="story">Story</option>
                </select>
              </BlockNew>

              <BlockNew row gap={8}>
                <Button
                  type="secondary"
                  onClick={resetFilters}
                >
                  Reset
                </Button>
                <Button
                  type="primary"
                  onClick={() => setShowFilters(false)}
                >
                  Apply
                </Button>
              </BlockNew>
            </BlockNew>
          )}

          {channelsLoading ? (
            <Text type="text" color="secondary" align="center">
              Loading channels...
            </Text>
          ) : channels && channels.length > 0 ? (
            <BlockNew id="channels-container">
              <Group>
                {channels.map((channel) => {
                  const channelName = channel.title || `@${channel.username || 'channel'}`
                  const subscribersCount = channel.stats?.subscribers_count || 0
                  const postPricing = channel.pricing?.find((p) => p.ad_format === 'post' && p.is_active)
                  
                  return (
                    <GroupItem
                      key={channel.id}
                      text={
                        <BlockNew row align="center" gap={8}>
                          <Text type="text" weight="bold">
                            {channelName}
                          </Text>
                          {channel.is_verified && (
                            <Icon name="verified" size={16} />
                          )}
                        </BlockNew>
                      }
                      description={
                        <BlockNew gap={6} row align="center" fadeIn={false}>
                          {subscribersCount > 0 && (
                            <>
                              <Text type="caption2" color="tertiary">
                                {pluralize(
                                  ['member', 'members', 'members'],
                                  subscribersCount
                                )}
                              </Text>
                              <Text type="caption2" color="tertiary">
                                •
                              </Text>
                            </>
                          )}
                          {postPricing && (
                            <Text type="caption2" color="accent">
                              {postPricing.price_ton} TON
                            </Text>
                          )}
                        </BlockNew>
                      }
                      chevron
                      before={
                        <Image
                          src={null}
                          size={40}
                          borderRadius={50}
                          fallback={channelName}
                        />
                      }
                      onClick={() => {
                        hapticFeedback('soft')
                        navigate(
                          ROUTES_NAME.MARKETPLACE_CHANNEL_DETAILS.replace(
                            ':id',
                            channel.id.toString()
                          )
                        )
                      }}
                    />
                  )
                })}
              </Group>
            </BlockNew>
          ) : (
            <Text type="text" color="secondary" align="center">
              No channels available
            </Text>
          )}
        </BlockNew>
      </PageLayout>
    </Page>
  )
}
