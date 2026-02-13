import type { DealStatus } from '@types'
import { Text } from '@components'
import styles from './DealStatusBadge.module.scss'
import cn from 'classnames'

interface DealStatusBadgeProps {
  status: DealStatus
  className?: string
}

const statusConfig: Record<
  DealStatus,
  { label: string; color: 'primary' | 'secondary' | 'accent' | 'danger' }
> = {
  pending: { label: 'Pending', color: 'secondary' },
  negotiating: { label: 'Negotiating', color: 'accent' },
  approved: { label: 'Approved', color: 'accent' },
  payment_pending: { label: 'Payment Pending', color: 'secondary' },
  paid: { label: 'Paid', color: 'accent' },
  // creative_submitted: { label: 'Creative Submitted', color: 'secondary' },
  // creative_approved: { label: 'Creative Approved', color: 'accent' },
  scheduled: { label: 'Scheduled', color: 'accent' },
  posted: { label: 'Posted', color: 'accent' },
  verified: { label: 'Verified', color: 'accent' },
  completed: { label: 'Completed', color: 'primary' },
  refunded: { label: 'Refunded', color: 'danger' },
  declined: { label: 'Declined', color: 'danger' },
}

export const DealStatusBadge = ({
  status,
  className,
}: DealStatusBadgeProps) => {
  const config = statusConfig[status]

  return (
    <div className={cn(styles.root, styles[`status-${status}`], className)}>
      <Text type="caption" weight="medium" color={config.color}>
        {config.label}
      </Text>
    </div>
  )
}
