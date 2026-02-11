import {useEffect, useState} from 'react'

import {Block} from '../Block'
import {Text} from '../Text'
import {Sheet} from "../Sheet";

import styles from './DeclineDealModal.module.scss';
import {confirmActionPopup} from "@utils";

interface DeclineDealModalProps {
  active: boolean
  onConfirm: (reason?: string) => void
  onClose: () => void
}

export const DeclineDealModal = ({active, onConfirm, onClose}: DeclineDealModalProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (active) {
      setIsOpen(true)
    } else {
      setTimeout(() => {
        setIsOpen(false)
        setReason('')
      }, 500)
    }
  }, [active])

  if (!isOpen) return undefined

  const handleConfirm = async () => {
    const ok = await confirmActionPopup('Decline Deal', 'Do you want to decline deal?');
    if (!ok) {
      return;
    }
    onConfirm(reason.trim() || undefined)
  }

  return (
    <Sheet opened={isOpen} onClose={() => setIsOpen(false)}>
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
    </Sheet>
  )
}
