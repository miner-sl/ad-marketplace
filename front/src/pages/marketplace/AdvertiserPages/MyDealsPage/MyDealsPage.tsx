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
  Group,
  GroupItem,
  Image,
  DealStatusBadge,
} from '@components'
import { useDealsQuery } from '@store-new'
import { ROUTES_NAME } from '@routes'
import { pluralize, hapticFeedback } from '@utils'
import type { DealStatus } from '@types'
import {useAuth} from "@context";

import styles from './MyDealsPage.module.scss'

const STATUS_OPTIONS: Array<DealStatus | 'all'> = [
  'all',
  'pending',
  'negotiating',
  'payment_pending',
  'paid',
  'creative_submitted',
  'creative_approved',
  'scheduled',
  'posted',
  'completed',
  'declined',
]

const formatStatusLabel = (status: DealStatus | 'all'): string => {
  if (status === 'all') return 'All';
  if (status === 'negotiating') return 'Need Changes';
  return status.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())
}


const dropdownOptions = STATUS_OPTIONS.map((status) => ({
  label: formatStatusLabel(status),
  value: status,
}))

export const MyDealsPage = () => {
  const navigate = useNavigate()
  const { user } = useAuth();
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
                <Icon name="sortArrows" size={18} color='tertiary' />
                <Dropdown
                  active={isDropdownOpen}
                  options={dropdownOptions}
                  selectedValue={selectedStatus}
                  onSelect={(value: string) =>
                    setSelectedStatus(value as DealStatus | 'all')
                  }
                  onClose={() => handleToggleDropdown(false)}
                  triggerRef={buttonRef as React.RefObject<HTMLElement>}
                />
              </div>
            </BlockNew>
          </BlockNew>

          {isLoading ? (
            <Text type="text" color="secondary" align="center">
              Loading...
            </Text>
          ) : filteredDeals.length > 0 ? (
            <BlockNew id="deals-container">
              <Group>
                {filteredDeals.map((deal) => {
                  const channelName = deal.channel?.title || `@${deal.channel?.username || 'channel'}`
                  const subscribersCount = deal.channel?.stats?.subscribers_count || 0
                  const isApproved = deal.status === 'approved';

                  return (
                    <GroupItem
                      key={deal.id}
                      text={
                        <BlockNew row align="center" gap={8}>
                          <Text type="text" weight="bold">
                            Deal #{deal.id}
                          </Text>
                          <DealStatusBadge status={deal.status} />
                        </BlockNew>
                      }
                      description={
                        <BlockNew gap={6} row align="center" fadeIn={false}>
                          <Text type="caption2" color="tertiary">
                            {channelName}
                          </Text>
                          {isApproved && (
                            <>
                              <Text type="caption2" color="tertiary">
                                •
                              </Text>
                              <Text type="caption2" color="tertiary">
                                {deal.scheduled_post_time}
                              </Text>
                            </>
                          )}
                          {subscribersCount > 0 && (
                            <>
                              <Text type="caption2" color="tertiary">
                                •
                              </Text>
                              <Text type="caption2" color="tertiary">
                                {pluralize(
                                  ['member', 'members', 'members'],
                                  subscribersCount
                                )}
                              </Text>
                            </>
                          )}
                          <Text type="caption2" color="tertiary">
                            • {deal.price_ton !== undefined ? deal.price_ton?.toFixed?.(2) + ' USDT' :''}
                          </Text>
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
                        navigate(ROUTES_NAME.MARKETPLACE_DEAL_DETAILS.replace(':id', deal.id.toString()))
                      }}
                    />
                  )
                })}
              </Group>
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
