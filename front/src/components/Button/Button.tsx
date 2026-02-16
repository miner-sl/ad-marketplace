import classNames from 'classnames'
import type { ReactNode } from 'react'

import styles from './Button.module.scss'

interface ButtonProps {
  children?: React.ReactNode
  disabled?: boolean
  prefix?: ReactNode
  postfix?: ReactNode
  onClick?(): void
  type?:
    | 'basic'
    | 'danger'
    | 'primary'
    | 'secondary'
    | 'link'
    | 'primary-gradient'
    | 'accent'
  size?: 'xs' |'small' | 'medium'
}

export const Button = ({
  children,
  onClick,
  disabled,
  postfix,
  prefix,
  type = 'basic',
  size = 'medium',
}: ButtonProps) => {
  return (
    <div
      className={classNames(
        styles.root,
        styles[`type-${type}`],
        disabled && styles.disabled,
        !disabled && styles.ripple,
        size && styles[`size-${size}`]
      )}
      onClick={() => {
        if (!disabled && onClick) {
          onClick()
        }
      }}
    >
      {prefix ? <div className={styles.prefix}>{prefix}</div> : null}
      {children}
      {postfix ? <div className={styles.postfix}>{postfix}</div> : null}
    </div>
  )
}
