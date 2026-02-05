import cn from 'classnames'

import styles from './Icon.module.scss'
import { getIcon } from './helpers'
import type { IconSize, IconTypeName } from './types'

interface IconProps {
  name: IconTypeName
  size?: IconSize
  color?: 'danger' | 'tertiary' | 'secondary' | 'accent' | 'primary' | 'brown'
  className?: string
  onClick?: (e: React.MouseEvent) => void
}

export const Icon = ({ name, size, color, className, onClick }: IconProps) => {
  // TODO refactor for three shaking
  const IconName = getIcon(name)

  if (!IconName) return null

  return (
    <div
      className={cn(
        styles.icon,
        size && styles[`size-${size}`],
        color && styles[`color-${color}`],
        onClick && styles.clickable,
        className
      )}
      onClick={onClick}
    >
      {IconName}
    </div>
  )
}
