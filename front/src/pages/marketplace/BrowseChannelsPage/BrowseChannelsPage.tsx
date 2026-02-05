import {useEffect, useState, useRef} from 'react'
import cn from 'classnames'
import {
  Block,
  BlockNew,
  Button,
  ChannelListItem,
  Group,
  Icon,
  ListInput,
  Page,
  PageLayout,
  TelegramBackButton,
  Text,
  Sheet,
  Dropdown,
} from '@components'
import {type EnhancedChannel, useChannelsQuery} from '@store-new'
import {useDebounce} from '@hooks'
import {PREDEFINED_TOPICS} from '../../../common/constants/topics'
import type {ChannelFilters} from '@types'

import styles from './BrowseChannelsPage.module.scss'

// const AD_FORMAT_OPTIONS: Array<AdFormat | ''> = ['', 'post', 'forward', 'story']
//
// const formatAdFormatLabel = (format: AdFormat | ''): string => {
//   if (format === '') return 'All formats'
//   return format.charAt(0).toUpperCase() + format.slice(1)
// }

export const BrowseChannelsPage = () => {
  // const navigate = useNavigate()
  // const { isMobile } = checkIsMobile()
  const isMobile = window.matchMedia('(max-width: 768px)').matches;
  console.log('isMobile', isMobile, 'isMobile');
  const [filters, setFilters] = useState<ChannelFilters>({
    limit: 14, // TODO calculate limit based on screen size
  })
  const [showFilters, setShowFilters] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebounce(searchInput, 500)
  const [isTopicDropdownOpen, setIsTopicDropdownOpen] = useState(false)
  const topicButtonRef = useRef<HTMLDivElement>(null)
  // const [isFormatDropdownOpen, setIsFormatDropdownOpen] = useState(false)
  // const formatButtonRef = useRef<HTMLDivElement>(null)

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

    if (key === 'topic_id') {
      const topicId = value ? parseInt(value) : undefined
      setFilters((prev) => ({
        ...prev,
        topic_id: topicId,
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

  // const handleFormatChange = (value: string) => {
  //   setFilters((prev) => ({
  //     ...prev,
  //     ad_format: value === '' ? undefined : (value as AdFormat),
  //   }))
  // }
  //
  // const handleToggleFormatDropdown = (value?: boolean) => {
  //   setIsFormatDropdownOpen(value !== undefined ? value : !isFormatDropdownOpen)
  // }
  //
  // const formatDropdownOptions = AD_FORMAT_OPTIONS.map((format) => ({
  //   label: formatAdFormatLabel(format),
  //   value: format,
  // }))

  const resetFilters = () => {
    setSearchInput('')
    setFilters({ limit: 14 })
  }

  const handleToggleTopicDropdown = (value?: boolean) => {
    setIsTopicDropdownOpen(value !== undefined ? value : !isTopicDropdownOpen)
  }

  const topicDropdownOptions = [
    { label: 'All Topics', value: '' },
    ...PREDEFINED_TOPICS.map((topic: { id: number; name: string }) => ({
      label: topic.name,
      value: topic.id.toString(),
    })),
  ]

  const selectedTopicLabel = filters.topic_id
    ? PREDEFINED_TOPICS.find((t) => t.id === filters.topic_id)?.name || 'Select topic'
    : 'All Topics'

  const FiltersContent = () => (
    <BlockNew gap={12} className={styles.filters}>
      <BlockNew gap={8}>
        <Text type="caption" color="secondary">
          Topic
        </Text>
        <div
          className={cn(styles.orderByContainer)}
          onClick={() => handleToggleTopicDropdown()}
          ref={topicButtonRef}
        >
          <Icon name="sortArrows" size={18} color="tertiary" />
          <Text type="text" color="primary">
            {selectedTopicLabel}
          </Text>
          <Dropdown
            active={isTopicDropdownOpen}
            options={topicDropdownOptions}
            selectedValue={filters.topic_id?.toString() || ''}
            onSelect={(value: string) => {
              handleFilterChange('topic_id', value)
              handleToggleTopicDropdown(false)
            }}
            onClose={() => handleToggleTopicDropdown(false)}
            triggerRef={topicButtonRef as React.RefObject<HTMLElement>}
          />
        </div>
      </BlockNew>

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
          Price (USDT)
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
  )

  return (
    <Page back>
      <PageLayout>
        <TelegramBackButton />
        <BlockNew gap={16} className={styles.container}>
          <BlockNew>
            <BlockNew row justify="between" align="center">
              <Text type="title2" weight="bold">
                Browse Channels
              </Text>
              <Button
                size="small"
                type="secondary"
                onClick={() => setShowFilters(!showFilters)}
              >
                {showFilters ? 'Hide' : 'Filters'}
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

          {!isMobile && showFilters && <FiltersContent />}

          {channelsLoading ? (
            <Text type="text" color="secondary" align="center">
              Loading channels...
            </Text>
          ) : channels && channels.length > 0 ? (
            <BlockNew id="channels-container">
              <Group>
                {channels.map((channel: EnhancedChannel) => (
                  <ChannelListItem
                    key={channel.id}
                    channel={channel}
                    showAdFormats
                    showTopic
                    showOwner
                  />
                ))}
              </Group>
            </BlockNew>
          ) : (
            <Text type="text" color="secondary" align="center">
              No channels available
            </Text>
          )}
        </BlockNew>
      </PageLayout>

      {isMobile && (
        <Sheet opened={showFilters} onClose={() => setShowFilters(false)}>
          <BlockNew gap={4} className={styles.filterContainer}>
            <BlockNew>
              <Text type="title" weight="bold">
                Filters
              </Text>
            </BlockNew>
            <FiltersContent />
          </BlockNew>
        </Sheet>
      )}
    </Page>
  )
}

