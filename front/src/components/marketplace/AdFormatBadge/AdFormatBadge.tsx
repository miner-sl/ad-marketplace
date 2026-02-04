import type { AdFormat } from '@types'
import { Text } from '@components'
import styles from './AdFormatBadge.module.scss'
import cn from 'classnames'

interface AdFormatBadgeProps {
  format: AdFormat
  className?: string
}

const formatConfig: Record<
  AdFormat,
  { label: string; color: 'primary' | 'secondary' | 'accent' }
> = {
  post: { label: 'Post', color: 'accent' },
  forward: { label: 'Forward', color: 'secondary' },
  story: { label: 'Story', color: 'primary' },
}

export const AdFormatBadge = ({
  format,
  className,
}: AdFormatBadgeProps) => {
  const config = formatConfig[format]

  return (
    <div className={cn(styles.root, styles[`format-${format}`], className)}>
      <Text type="caption" weight="medium" color={config.color}>
        {config.label}
      </Text>
    </div>
  )
}
