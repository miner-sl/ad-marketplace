import {type RefObject, useEffect, useRef, useState} from 'react';
import {
  BlockNew,
  Button,
  ChannelListSnippet,
  Dropdown, type DropdownOption,
  Group,
  Icon,
  List,
  ListInput,
  ListItem,
  Page,
  PageLayout,
  Sheet, Spinner,
  TelegramBackButton,
  Text,
} from '@components'
import {FiltersContent} from './ChannelFilters';

import {type EnhancedChannel, useChannelsQuery} from '@store-new';
import {useDebounce} from '@hooks';
import type {ChannelFilters} from '@types';
import {hapticFeedback} from "@utils";

import styles from './BrowseChannelsPage.module.scss';

const SORT_OPTIONS: DropdownOption[]= [
  { label: 'Popular', value: 'subscribers_count:desc' },
  { label: 'UnPopular', value: 'subscribers_count:asc' },
];

export const BrowseChannelsPage = () => {
  const isMobile = window.matchMedia('(max-width: 768px)').matches;
  const [filters, setFilters] = useState<ChannelFilters>({
    limit: 14, // TODO calculate limit based on screen size
    sort: { field: 'subscribers_count', direction: 'desc' },
  });
  const [showFilters, setShowFilters] = useState(false)
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false)
  const sortButtonRef = useRef<HTMLDivElement>(null)
  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebounce(searchInput, 500)

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

  const onFilterChange = (value: ChannelFilters) => {
    setFilters((prev) => ({
      ...value,
      sort: value.sort ?? prev.sort ?? { field: 'subscribers_count', direction: 'desc' },
    }));
    setShowFilters(false);
  }

  const onToggleFilters = () => {
    hapticFeedback('light');
    setShowFilters(prev => !prev);
  };

  const onResetFilters = () => {
    hapticFeedback('soft');
    setFilters({ limit: 14, sort: { field: 'subscribers_count', direction: 'desc' } });
  };

  const sortValue = filters.sort
    ? `${filters.sort.field}:${filters.sort.direction}`
    : 'subscribers_count:desc';

  const handleSortSelect = (value: string) => {
    if (channelsLoading) {
      return;
    }
    hapticFeedback('soft');
    setIsSortDropdownOpen(false);
    const [field, direction] = value.split(':') as [string, 'asc' | 'desc'];
    // @ts-ignore
    setFilters((prev: ChannelFilters) => ({ ...prev, sort: { field, direction } }));
    setIsSortDropdownOpen(false);
  };

  const toggleSortDropdown = () => {
    hapticFeedback('soft');
    setIsSortDropdownOpen((v) => !v);
  };

  return (
    <Page back>
      <PageLayout>
        <TelegramBackButton />
        <BlockNew gap={16} className={styles.container}>
          <BlockNew>
            <BlockNew row justify="between" align="center" gap={8}>
              <BlockNew>
                <Text type="title2" weight="bold">
                  Channels
                </Text>
              </BlockNew>
              <BlockNew row gap={8} justify="end">
                <div
                  className={styles.orderByContainer}
                  onClick={toggleSortDropdown}
                  ref={sortButtonRef}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && toggleSortDropdown()}
                >
                  <Icon name="sortArrows" size={18} color="secondary"/>
                  <Dropdown
                    active={isSortDropdownOpen}
                    options={SORT_OPTIONS}
                    selectedValue={sortValue}
                    onSelect={handleSortSelect}
                    onClose={() => setIsSortDropdownOpen(false)}
                    triggerRef={sortButtonRef as RefObject<HTMLElement>}
                  />
                </div>

                <Button
                  size="small"
                  type="secondary"
                  onClick={onToggleFilters}
                >
                  {showFilters ? 'Hide' : 'Filters'}
                </Button>
              </BlockNew>
            </BlockNew>
          </BlockNew>

          <List>
            <ListItem padding="0 16px">
              <ListInput
                before={<Icon name="searchGlass" size={16}/>}
                showClearButton
                textColor="secondary"
                type="text"
                placeholder="Search by name or username"
                value={searchInput}
                onChange={(value) => setSearchInput(value)}
              />
            </ListItem>
          </List>

          {!isMobile && showFilters && (
            <FiltersContent value={filters} onSelect={onFilterChange}/>
          )}

          {channelsLoading ? (
            <BlockNew row gap={8}>
              <Spinner size={18}/>
              <Text type="text" color="secondary" align="center">
                Loading channels...
              </Text>
            </BlockNew>
          ) : channels && channels.length > 0 ? (
            <BlockNew id="channels-container">
              <Group>
                {channels.map((channel: EnhancedChannel) => (
                  <ChannelListSnippet
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
            <>
              <Text type="text" color="secondary" align="center">
                No found channels
              </Text>
              <Button type='secondary' onClick={onResetFilters}>
                Reset
              </Button>
            </>
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
            <FiltersContent value={filters} onSelect={onFilterChange} />
          </BlockNew>
        </Sheet>
      )}
    </Page>
  )
}

