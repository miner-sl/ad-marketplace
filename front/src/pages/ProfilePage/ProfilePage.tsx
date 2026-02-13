import { useNavigate } from 'react-router-dom';
import { openTelegramLink } from '@tma.js/sdk-react';

import {
  BlockNew,
  PageLayout,
  Page,
  Text,
  Button,
  Image,
  Group,
  GroupItem,
} from '@components';
import { useAuth } from '@context';
import { ROUTES_NAME } from '@routes';

import type {User} from "@types";

function formatNameOfUser(user: User) {
  return user.first_name || user.firstName
    ? `${user.first_name || user.firstName}${
      user.last_name || user.lastName
        ? ` ${user.last_name || user.lastName}`
        : ''
    }`
    : user.username || 'User';
}

export function ProfilePage() {
  const { user, logout, isTelegramMiniApp } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  }

  if (!user) {
    return undefined;
  }

  const displayName = formatNameOfUser(user);

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
        <BlockNew gap={2}>
          <BlockNew gap={12} align="center">
            <Image
              src={user.photoUrl || undefined}
              size={112}
              borderRadius={50}
              fallback={avatarFallback}
            />
            <BlockNew gap={4}>
              <Text type="title1" weight="bold" align="center">
                {displayName}
                {user.isPremium && (
                  <Text as="span" type="text" weight="bold" color="accent">
                    {' ⭐'}
                  </Text>
                )}
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

          <BlockNew gap={12} margin="top" marginValue={24}>
            <Group header="WALLET">
              <GroupItem
                text="Transactions"
                description="View transaction history"
                chevron
                onClick={() => navigate(ROUTES_NAME.TRANSACTIONS)}
              />
              <GroupItem
                text="Analytics"
                description="Wallet balance summary"
                chevron
                onClick={() => navigate(ROUTES_NAME.ANALYTICS)}
              />
            </Group>
            <Group header="USER INFORMATION">
              {(user.telegram_id || user.telegramId) && (
                <GroupItem
                  text="Telegram ID"
                  after={
                    <Text type="text" weight="medium">
                      {user.telegram_id || user.telegramId}
                    </Text>
                  }
                />
              )}

              {((user.is_channel_owner || user.isChannelOwner) ||
                (user.is_advertiser || user.isAdvertiser)) && (
                <GroupItem
                  text="Roles"
                  after={
                    <Text type="text" weight="medium">
                      {[
                        (user.is_channel_owner || user.isChannelOwner) &&
                          'Channel Owner',
                        (user.is_advertiser || user.isAdvertiser) && 'Advertiser',
                      ]
                        .filter(Boolean)
                        .join(', ')}
                    </Text>
                  }
                />
              )}

              {user.languageCode && (
                <GroupItem
                  text="Language"
                  after={
                    <Text type="text" weight="medium">
                      {user.languageCode.toUpperCase()}
                    </Text>
                  }
                />
              )}
            </Group>
          </BlockNew>

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
