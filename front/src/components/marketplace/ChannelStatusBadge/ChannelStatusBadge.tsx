import { Text } from '@components'
import styles from './ChannelStatusBadge.module.scss'
import cn from 'classnames'

type ChannelStatus = 'active' | 'inactive' | 'moderation'

interface ChannelStatusBadgeProps {
  status: ChannelStatus
  className?: string
}

const statusConfig: Record<
  ChannelStatus,
  { label: string; color: 'primary' | 'secondary' | 'accent' | 'danger' }
> = {
  active: { label: 'Active', color: 'accent' },
  inactive: { label: 'Inactive', color: 'secondary' },
  moderation: { label: 'Moderation', color: 'secondary' },
}

export const ChannelStatusBadge = ({
  status,
  className,
}: ChannelStatusBadgeProps) => {
  const config = statusConfig[status]

  return (
    <div className={cn(styles.root, styles[`status-${status}`], className)}>
      <Text type="caption" weight="medium" color={config.color}>
        {config.label}
      </Text>
    </div>
  )
}
