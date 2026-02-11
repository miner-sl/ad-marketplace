import React, {useRef, useState} from 'react';
import cn from 'classnames';

import {BlockNew, Button, Dropdown, Group, Icon, ListInput, Text} from '@components';
import {PREDEFINED_TOPICS} from '../../../common/constants/topics';
import type {ChannelFilters} from '@types';
import {hapticFeedback} from '@utils';

import styles from './BrowseChannelsPage.module.scss';

type Props = {
  value?: ChannelFilters;
  onSelect: (value: ChannelFilters) => void;
}

export const FiltersContent: React.FC<Props> = ({
  value,
  onSelect,
}: Props) => {
  const [isTopicDropdownOpen, setIsTopicDropdownOpen] = useState(false);
  const topicButtonRef = useRef<HTMLDivElement>(null)
  const [filters, setFilters] = useState<ChannelFilters>(value || {
    limit: 14, // TODO calculate limit based on screen size
  })
  const handleResetFilters = () => {
    setFilters({limit: 14});
  }

  const handleToggleTopicDropdown = (value?: boolean) => {
    setIsTopicDropdownOpen(value !== undefined ? value : !isTopicDropdownOpen)
  }

  const topicDropdownOptions = [
    { label: 'Any Topics', value: '' },
    ...PREDEFINED_TOPICS.map((topic: { id: number; name: string }) => ({
      label: topic.name,
      value: topic.id.toString(),
    })),
  ]


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


  const selectedTopicLabel = filters.topic_id
    ? PREDEFINED_TOPICS.find((t) => t.id === filters.topic_id)?.name || 'Select topic'
    : 'Any Topics'

  const handleApply = () => {
    onSelect(filters);
    hapticFeedback('soft');
  };
  const onClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation()
    handleToggleTopicDropdown();
  }
  return (
    <BlockNew gap={12} className={styles.filters}>
      <BlockNew gap={8}>
        <Text type="caption" color="secondary">
          Topic
        </Text>
        <div
          className={cn(styles.orderByContainer)}
          onClick={onClick}
          ref={topicButtonRef}
        >
          <Icon name="sortArrows" size={18} color="tertiary"/>
          <Text type="text" color="primary">
            {selectedTopicLabel}
          </Text>
          <Dropdown
            active={isTopicDropdownOpen}
            options={topicDropdownOptions}
            selectedValue={filters.topic_id?.toString() || ''}
            onSelect={(value: string) => {
              handleToggleTopicDropdown(false);
              handleFilterChange('topic_id', value)
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
            min={0}
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
