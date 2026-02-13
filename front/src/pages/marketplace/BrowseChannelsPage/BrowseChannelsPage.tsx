import {useEffect, useState} from 'react';
import {
  BlockNew,
  Button,
  ChannelListItem,
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

export const BrowseChannelsPage = () => {
  const isMobile = window.matchMedia('(max-width: 768px)').matches;
  const [filters, setFilters] = useState<ChannelFilters>({
    limit: 14, // TODO calculate limit based on screen size
  });
  const [showFilters, setShowFilters] = useState(false)
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
    setFilters(value);
    setShowFilters(false);
  }

  const onToggleFilters = () => {
    hapticFeedback('light');
    setShowFilters(prev => !prev);
  };

  const onResetFilters = () => {
    hapticFeedback('soft');
    setFilters({limit: 14});
  };

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
                onClick={onToggleFilters}
              >
                {showFilters ? 'Hide' : 'Filters'}
              </Button>
            </BlockNew>
          </BlockNew>

          <List>
            <ListItem padding="0 16px">
              <ListInput
                before={<Icon name="searchGlass" size={16} />}
                showClearButton
                textColor="secondary"
                type="text"
                placeholder="Search by channel name or username..."
                value={searchInput}
                onChange={(value) => setSearchInput(value)}
              />
            </ListItem>
          </List>

          {!isMobile && showFilters && (
            <FiltersContent value={filters} onSelect={onFilterChange} />
          )}

          {channelsLoading ? (
            <BlockNew row gap={8}>
              <Spinner size={18} />
              <Text type="text" color="secondary" align="center">
                Loading channels...
              </Text>
            </BlockNew>
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

