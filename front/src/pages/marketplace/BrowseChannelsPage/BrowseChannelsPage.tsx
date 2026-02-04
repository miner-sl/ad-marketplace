import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import cn from 'classnames'
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
  Block,
  Dropdown,
  AdFormatBadge,
} from '@components'
import { useChannelsQuery, type EnhancedChannel } from '@store-new'
import { ROUTES_NAME } from '@routes'
import {pluralize, hapticFeedback} from '@utils'
import {useDebounce} from '@hooks'
import type { ChannelFilters, AdFormat } from '@types'

import styles from './BrowseChannelsPage.module.scss'

const AD_FORMAT_OPTIONS: Array<AdFormat | ''> = ['', 'post', 'forward', 'story']

const formatAdFormatLabel = (format: AdFormat | ''): string => {
  if (format === '') return 'All formats'
  return format.charAt(0).toUpperCase() + format.slice(1)
}

export const BrowseChannelsPage = () => {
  const navigate = useNavigate()
  const [filters, setFilters] = useState<ChannelFilters>({
    limit: 14,
  })
  const [showFilters, setShowFilters] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebounce(searchInput, 500)
  const [isFormatDropdownOpen, setIsFormatDropdownOpen] = useState(false)
  const formatButtonRef = useRef<HTMLDivElement>(null)

  // Update filters when debounced search value changes
  useEffect(() => {
    if (debouncedSearch === '') {
      setFilters((prev) => {
        const { search: _, ...rest } = prev
        return rest
      })
    } else {
      setFilters((prev) => ({
        ...prev,
        search: debouncedSearch,
      }))
    }
  }, [debouncedSearch])

  const { data: channels, isLoading: channelsLoading } = useChannelsQuery(filters)

  const handleFilterChange = (key: keyof ChannelFilters, value: string) => {
    if (value === '') {
      setFilters((prev) => {
        const { [key]: _, ...rest } = prev
        return rest
      })
      return
    }

    if (key === 'search') {
      setFilters((prev) => ({
        ...prev,
        [key]: value,
      }))
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

  const handleToggleFormatDropdown = (value?: boolean) => {
    setIsFormatDropdownOpen(value !== undefined ? value : !isFormatDropdownOpen)
  }

  const formatDropdownOptions = AD_FORMAT_OPTIONS.map((format) => ({
    label: formatAdFormatLabel(format),
    value: format,
  }))

  const resetFilters = () => {
    setSearchInput('')
    setFilters({ limit: 14 })
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
                size="small"
                type="secondary"
                onClick={() => setShowFilters(!showFilters)}
              >
                {showFilters ? 'Hide Filters' : 'Filters'}
              </Button>
            </BlockNew>
          </BlockNew>

          <Group>
            <Block>
              <ListInput
                before={<Icon name="searchGlass" size={16} />}
                showClearButton
                textColor="secondary"
                type="text"
                placeholder="Search by channel name or username..."
                value={searchInput}
                onChange={(value) => setSearchInput(value)}
              />
            </Block>
          </Group>

          {showFilters && (
            <BlockNew gap={12} padding="0 16px" className={styles.filters}>
              <BlockNew gap={8}>
                <Text type="caption" color="secondary">
                  Subscribers
                </Text>
                <Group>
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
                </Group>
              </BlockNew>

              <BlockNew gap={8}>
                <Text type="caption" color="secondary">
                  Price (TON)
                </Text>
                <Group>
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
                </Group>
              </BlockNew>

              <BlockNew gap={8}>
                <Text type="caption" color="secondary">
                  Average Views
                </Text>
                <Group>
                  <ListInput
                    type="number"
                    placeholder="Minimum views"
                    value={filters.min_views?.toString() || ''}
                    onChange={(value) => handleFilterChange('min_views', value)}
                    inputMode="numeric"
                  />
                </Group>
              </BlockNew>

              {/* <BlockNew gap={8}>
                <Text type="caption" color="secondary">
                  Ad Format
                </Text>
                <div
                  className={cn(styles.orderByContainer)}
                  onClick={() => handleToggleFormatDropdown()}
                  ref={formatButtonRef}
                >
                  <Icon name="sortArrows" size={18} color="tertiary" />
                  <Dropdown
                  active={isFormatDropdownOpen}
                  options={formatDropdownOptions}
                  selectedValue={filters.ad_format || ''}
                  onSelect={(value: string) => {
                    handleFormatChange(value)
                    handleToggleFormatDropdown(false)
                  }}
                  onClose={() => handleToggleFormatDropdown(false)}
                  triggerRef={formatButtonRef as React.RefObject<HTMLElement>}
                />
                </div>
              </BlockNew> */}

              <BlockNew row gap={8}>
                <Button
                  size="small"
                  type="secondary"
                  onClick={resetFilters}
                >
                  Reset
                </Button>
                <Button
                  size="small"
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
                {channels.map((channel: EnhancedChannel) => {
                  const { activeAdFormats, topic, channelName, subscribersCount, postPricing } = channel

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
                          {activeAdFormats.length > 0 && (
                            <BlockNew row gap={4} align="center">
                              {activeAdFormats.map((format) => (
                                <AdFormatBadge key={format} format={format} />
                              ))}
                            </BlockNew>
                          )}
                          {topic && (
                            <div style={{ padding: '2px 8px', borderRadius: '6px', background: 'var(--color-background-tertiary)' }}>
                              <Text type="caption" color="secondary">
                                {topic.name}
                              </Text>
                            </div>
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
