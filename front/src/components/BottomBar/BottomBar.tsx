import type { ReactNode } from 'react'

import styles from './BottomBar.module.scss'

interface BottomBarProps {
  children: ReactNode
  className?: string
}

interface BottomBarRowProps {
  children: ReactNode
}

interface BottomBarItemProps {
  children: ReactNode
  onClick?: () => void
}

export const BottomBar = ({ children, className }: BottomBarProps) => {
  return (
    <nav className={`${styles.root} ${className ?? ''}`.trim()} aria-label="Bottom navigation">
      {children}
    </nav>
  )
}

export const BottomBarRow = ({ children }: BottomBarRowProps) => {
  return <div className={styles.row}>{children}</div>
}

export const BottomBarItem = ({ children, onClick }: BottomBarItemProps) => {
  return (
    <button type="button" className={styles.item} onClick={onClick}>
      {children}
    </button>
  )
}

BottomBar.Row = BottomBarRow
BottomBar.Item = BottomBarItem
