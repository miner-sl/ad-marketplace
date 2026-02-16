import { useNavigate } from 'react-router-dom'

import { BlockNew, Text, Image } from '@components';
import { useAuth } from '@context';
import { ROUTES_NAME } from '@routes';
import { useUpdateWalletAddress } from '@hooks';

import styles from './AppHeader.module.scss';
import { TonConnectButton } from '@tonconnect/ui-react';

export function AppHeader() {
  const { user } = useAuth()
  const navigate = useNavigate()

  useUpdateWalletAddress()

  if (!user) {
    return null
  }

  const avatarFallback = (user.first_name || user.firstName || user.username || 'U')
    .charAt(0)
    .toUpperCase()

  return (
    <header className={styles.header}>
      <BlockNew row gap={12} align="center" justify="between" className={styles.container}>
        <span
          onClick={() => navigate(ROUTES_NAME.MARKETPLACE_HOME)}
          className={styles.logo}
        >
          <Text type="caption2" weight="bold">
            Ads Marketplace
          </Text>
        </span>
        <TonConnectButton />
        <BlockNew row gap={8} align="center" className={styles.userInfo}>
          <span
            onClick={() => navigate(ROUTES_NAME.PROFILE)}
            className={styles.avatarLink}
          >
            <Image
              src={user.photoUrl || undefined}
              size={40}
              borderRadius={50}
              fallback={avatarFallback}
            />
          </span>
        </BlockNew>

      </BlockNew>
    </header>
  )
}
