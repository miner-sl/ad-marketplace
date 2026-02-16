import React, {useState} from 'react';

import {AppSelect, BlockNew, Button, Group, GroupItem, ListInput, Text} from '@components';

import {PREDEFINED_TOPICS} from '../../../common/constants/topics';
import {type ChannelFilters, COUNTRIES, LOCALES, type SelectOption} from '@types';
import {hapticFeedback} from '@utils';

import styles from './BrowseChannelsPage.module.scss';

const countries: SelectOption[] = [{value: '', name: 'Any'}, ...COUNTRIES];
const locales: SelectOption[] = [{value: '', name: 'Any'}, ...LOCALES];
const topicDropdownOptions: SelectOption[] = [
  { name: 'Any', value: '' },
  ...PREDEFINED_TOPICS.map((topic: { id: number; name: string }) => ({
    name: topic.name,
    value: topic.id.toString(),
  })),
]

type Props = {
  value?: ChannelFilters;
  onSelect: (value: ChannelFilters) => void;
}

export const FiltersContent: React.FC<Props> = ({
  value,
  onSelect,
}: Props) => {
  const [filters, setFilters] = useState<ChannelFilters>(value || {
    limit: 14, // TODO calculate limit based on screen size
  })

  const handleFilterChange = (key: keyof ChannelFilters, value: string) => {
    hapticFeedback('soft');
    if (value === '') {
      setFilters((prev) => {
        const {[key]: _, ...rest} = prev
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
      const topicId = value ? parseInt(value, 10) : undefined
      setFilters((prev) => ({
        ...prev,
        topic_id: topicId,
      }))
      return
    }

    if (key === 'country' || key === 'locale') {
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

  const handleResetFilters = () => {
    hapticFeedback('light');
    setFilters({limit: 14});
  }

  const handleApply = () => {
    onSelect(filters);
    hapticFeedback('soft');
  };

  return (
    <BlockNew gap={12} className={styles.filters}>
      <Group>
        <GroupItem
          text="Topic"
          after={
            <AppSelect
              options={topicDropdownOptions}
              value={filters.topic_id?.toString() || ''}
              onChange={(value: string) => handleFilterChange('topic_id', value)}
              placeholder="Any"
            />
          }
        />
      </Group>
      <BlockNew gap={8}>
        <Text type="caption" color="secondary">
          Subscribers
        </Text>
        <Group>
          <BlockNew row gap={8}>
            <ListInput
              type="number"
              min={0}
              placeholder="Min"
              value={filters.min_subscribers?.toString() || ''}
              onChange={(value) => handleFilterChange('min_subscribers', value)}
              inputMode="numeric"
            />
            <ListInput
              type="number"
              min={0}
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
            min={0}
            type="number"
            placeholder="Minimum views"
            value={filters.min_views?.toString() || ''}
            onChange={(value) => handleFilterChange('min_views', value)}
            inputMode="numeric"
          />
        </Group>
      </BlockNew>

      <Group>
        <GroupItem
          text="Country"
          after={
           <AppSelect
             options={countries}
             value={filters.country ?? ''}
             onChange={(value) => handleFilterChange('country', value)}
             placeholder="Any"
           />
          }
        />
      </Group>

      <Group>
        <GroupItem
          text="Locale"
          after={
            <AppSelect
              options={locales}
              value={filters.locale ?? ''}
              onChange={(value) => handleFilterChange('locale', value)}
              placeholder="Any"
            />
          }
        />
      </Group>

      <BlockNew row gap={8}>
        <Button
          size="small"
          type="secondary"
          onClick={handleResetFilters}
        >
          Reset
        </Button>
        <Button
          size="small"
          type="primary"
          onClick={handleApply}
        >
          Apply
        </Button>
      </BlockNew>
    </BlockNew>
  )
}
