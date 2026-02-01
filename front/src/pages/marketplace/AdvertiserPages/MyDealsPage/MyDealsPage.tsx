import { useNavigate } from 'react-router-dom'
import { useState, useRef } from 'react'
import type React from 'react'
import cn from 'classnames'
import {
  BlockNew,
  PageLayout,
  Page,
  TelegramBackButton,
  Text,
  Dropdown,
  Icon,
} from '@components'
import { DealCard } from '@components'
import { useDealsQuery } from '@store-new'
import { useUser } from '@store'
import type { DealStatus } from '@types'
import styles from './MyDealsPage.module.scss'

const STATUS_OPTIONS: Array<DealStatus | 'all'> = [
  'all',
  'pending',
  'payment_pending',
  'paid',
  'creative_submitted',
  'creative_approved',
  'scheduled',
  'posted',
  'completed',
  'cancelled',
]

const formatStatusLabel = (status: DealStatus | 'all'): string => {
  if (status === 'all') return 'All'
  return status.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())
}

export const MyDealsPage = () => {
  const navigate = useNavigate()
  const { user } = useUser()
  const [selectedStatus, setSelectedStatus] = useState<DealStatus | 'all'>('all')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const buttonRef = useRef<HTMLDivElement>(null)
  const { data: deals, isLoading } = useDealsQuery({
    user_id: user?.id,
    status: selectedStatus === 'all' ? undefined : selectedStatus as DealStatus,
  })

  const handleToggleDropdown = (value?: boolean) => {
    setIsDropdownOpen(value !== undefined ? value : !isDropdownOpen)
  }

  const dropdownOptions = STATUS_OPTIONS.map((status) => ({
    label: formatStatusLabel(status),
    value: status,
  }))

  const filteredDeals = deals || [];

  // const myDeals =
  // deals?.filter((deal) => deal.advertiser_id === user?.id) || []

  // const filteredDeals = 
  //   selectedStatus === 'all'
  //     ? myDeals
  //     : myDeals.filter((deal) => deal.status === selectedStatus)

  return (
    <Page back>
      <PageLayout>
        <TelegramBackButton />
        <BlockNew gap={4} className={styles.container}>
          <BlockNew gap={2} row justify="between" align="center" >
            <BlockNew >
              <Text type="title" weight="bold">
                My Deals
              </Text>

            </BlockNew>

            <BlockNew className={styles.filters}>
              <div
                className={cn(styles.orderByContainer)}
                onClick={() => handleToggleDropdown()}
                ref={buttonRef}
              >
                <Icon name="sortArrows" size={18} color="secondary" />
                <span style={{ marginLeft: '8px' }}>
                  <Text type="text" color="secondary">
                    {formatStatusLabel(selectedStatus)}
                  </Text>
                </span>
                <Dropdown
                  active={isDropdownOpen}
                  options={dropdownOptions}
                  selectedValue={selectedStatus}
                  onSelect={(value: string) =>
                    setSelectedStatus(value as DealStatus | 'all')
                  }
                  onClose={() => handleToggleDropdown(false)}
                  triggerRef={buttonRef as React.RefObject<HTMLElement> | undefined}
                />
              </div>
            </BlockNew>
          </BlockNew>

          {isLoading ? (
            <Text type="text" color="secondary" align="center">
              Loading...
            </Text>
          ) : filteredDeals.length > 0 ? (
            <BlockNew gap={8}>
              {filteredDeals.map((deal) => (
                <DealCard
                  key={deal.id}
                  deal={deal}
                  onClick={() => navigate(`/marketplace/deals/${deal.id}`)}
                />
              ))}
            </BlockNew>
          ) : (
            <Text type="text" color="secondary" align="center">
              {selectedStatus === 'all'
                ? 'You don\'t have any deals yet.'
                : `No deals with status "${selectedStatus.replace('_', ' ')}".`}
            </Text>
          )}
        </BlockNew>
      </PageLayout>
    </Page>
  )
}
