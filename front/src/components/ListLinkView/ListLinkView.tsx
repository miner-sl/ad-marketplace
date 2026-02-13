import { BlockNew, Icon, ListItem, Text } from '@components'
import { useClipboard } from '@hooks'
import { goTo } from '@utils'

import styles from './ListLinkView.module.scss'

export interface ListLinkViewProps {
  title: string
  value: string
  link: string
  copyText?: string
}

export const ListLinkView = ({
  title,
  value,
  link,
  copyText = 'Copied to clipboard',
}: ListLinkViewProps) => {
  const { copy } = useClipboard()

  const handleLinkClick = () => {
    goTo(link)
  }

  const handleCopyClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    copy(link, copyText)
  }

  return (
    <ListItem
      text={title}
      after={
        <BlockNew row align="center" gap={8} onClick={handleLinkClick} className={styles.clickable}>
          <Text type="text" color="accent">
            {value}
          </Text>
          <Icon
            name="share"
            size={20}
            color="accent"
            className={styles.clickable}
            onClick={handleCopyClick}
          />
        </BlockNew>
      }
    />
  )
}
