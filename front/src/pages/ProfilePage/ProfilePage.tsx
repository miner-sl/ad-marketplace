import { useNavigate } from 'react-router-dom'
import { openTelegramLink } from '@tma.js/sdk-react'
import {
  BlockNew,
  PageLayout,
  Page,
  Text,
  Button,
  Image,
} from '@components'
import { useAuth } from '@context'
import styles from './ProfilePage.module.scss'

export function ProfilePage() {
  const { user, logout, isTelegramMiniApp } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  if (!user) {
    return null
  }

  const displayName =
    user.first_name || user.firstName
      ? `${user.first_name || user.firstName}${
          user.last_name || user.lastName
            ? ` ${user.last_name || user.lastName}`
            : ''
        }`
      : user.username || 'User'

  const avatarFallback = (user.first_name || user.firstName || user.username || 'U')
    .charAt(0)
    .toUpperCase()

  const handleUsernameClick = () => {
    if (user.username) {
      openTelegramLink(`https://t.me/${user.username.replace('@', '')}`)
    } else if (user.telegram_id || user.telegramId) {
      // For users without username, use user ID
      openTelegramLink(`https://t.me/user${user.telegram_id || user.telegramId}`)
    }
  }

  return (
    <Page>
      <PageLayout>
        <BlockNew gap={24} className={styles.container}>
          {/* Profile Header */}
          <BlockNew gap={12} className={styles.header}>
            <Image
              src={user.photoUrl || undefined}
              size={112}
              borderRadius={50}
              fallback={avatarFallback}
            />
            <BlockNew gap={4}>
              <Text type="title1" weight="bold" align="center">
                {displayName}
              </Text>
              {user.username && (
                <span 
                  onClick={handleUsernameClick}
                  style={{ cursor: 'pointer' }}
                >
                  <Text type="text" color="accent" align="center">
                    @{user.username}
                  </Text>
                </span>
              )}
            </BlockNew>
          </BlockNew>

          {/* User Info */}
          <BlockNew gap={16} className={styles.infoSection}>
            <BlockNew gap={8}>
              <Text type="title2" weight="bold">
                User Information
              </Text>
            </BlockNew>

            <BlockNew gap={12}>
              {(user.telegram_id || user.telegramId) && (
                <BlockNew row gap={8}>
                  <Text type="text" color="secondary">
                    Telegram ID:
                  </Text>
                  <Text type="text" weight="medium">
                    {user.telegram_id || user.telegramId}
                  </Text>
                </BlockNew>
              )}

              {((user.is_channel_owner || user.isChannelOwner) ||
                (user.is_advertiser || user.isAdvertiser)) && (
                <BlockNew row gap={8}>
                  <Text type="text" color="secondary">
                    Roles:
                  </Text>
                  <Text type="text" weight="medium">
                    {[
                      (user.is_channel_owner || user.isChannelOwner) &&
                        'Channel Owner',
                      (user.is_advertiser || user.isAdvertiser) && 'Advertiser',
                    ]
                      .filter(Boolean)
                      .join(', ')}
                  </Text>
                </BlockNew>
              )}

              {user.languageCode && (
                <BlockNew row gap={8}>
                  <Text type="text" color="secondary">
                    Language:
                  </Text>
                  <Text type="text" weight="medium">
                    {user.languageCode.toUpperCase()}
                  </Text>
                </BlockNew>
              )}

              {user.isPremium && (
                <BlockNew row gap={8}>
                  <Text type="text" color="secondary">
                    Status:
                  </Text>
                  <Text type="text" weight="medium" color="accent">
                    ⭐ Premium
                  </Text>
                </BlockNew>
              )}
            </BlockNew>
          </BlockNew>

          {/* Logout Button */}
          {!isTelegramMiniApp && (
            <BlockNew gap={12}>
              <Button type="danger" onClick={handleLogout}>
                Logout
              </Button>
            </BlockNew>
          )}
        </BlockNew>
      </PageLayout>
    </Page>
  )
}
