import { useEffect, useState } from 'react'
import cn from 'classnames'

import { Block } from '../Block'
import { Text } from '../Text'
import styles from './DeclineDealModal.module.scss'

interface DeclineDealModalProps {
  active: boolean
  onConfirm: (reason?: string) => void
  onClose: () => void
}

export const DeclineDealModal = ({ active, onConfirm, onClose }: DeclineDealModalProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (active) {
      setIsOpen(true)
    } else {
      setTimeout(() => {
        setIsOpen(false)
        setReason('') // Reset reason when closing
      }, 500)
    }
  }, [active])

  if (!isOpen) return null

  const handleConfirm = () => {
    onConfirm(reason.trim() || undefined)
  }

  return (
    <div className={cn(styles.declineModal, active && styles.declineModalActive)}>
      <div className={styles.declineModalOverlay} onClick={onClose} />
      <div className={styles.declineModalContent}>
        <div className={styles.declineModalContentHeader}>
          <Block>
            <Text type="text" weight="medium" align="center">
              Decline Deal
            </Text>
          </Block>
          <Block margin="top" marginValue={4}>
            <Text type="caption" color="primary" align="center">
              Are you sure you want to decline this deal? This action cannot be undone.
            </Text>
          </Block>
          <Block margin="top" marginValue={16}>
            <Text type="caption" color="secondary" align="left">
              Reason (optional)
            </Text>
            <textarea
              className={styles.reasonTextarea}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Enter reason for declining..."
              rows={4}
              maxLength={500}
            />
          </Block>
        </div>
        <div className={styles.declineModalContentFooter}>
          <div
            className={styles.declineModalContentFooterButton}
            onClick={onClose}
          >
            <Text type="text" color="accent">
              Cancel
            </Text>
          </div>
          <div
            className={styles.declineModalContentFooterButton}
            onClick={handleConfirm}
          >
            <Text type="text" color="danger">
              Decline
            </Text>
          </div>
        </div>
      </div>
    </div>
  )
}
