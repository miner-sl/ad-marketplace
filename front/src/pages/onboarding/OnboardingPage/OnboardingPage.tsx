import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';

import {
  BlockNew,
  PageLayout,
  Page,
  Text,
  TelegramMainButton,
  useToast,
} from '@components';
import { useTelegramUser } from '@hooks';
import { useRegisterUserMutation } from '@store-new';
import { ROUTES_NAME } from '@routes';
import { TANSTACK_KEYS, setStoredTelegramUserId } from '@utils';
import type { UserRole } from '@types';

import styles from './OnboardingPage.module.scss'

export const OnboardingPage = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const telegramUser = useTelegramUser()
  const registerUserMutation = useRegisterUserMutation()
  const [selectedRoles, setSelectedRoles] = useState<UserRole[]>([])
  const {showToast} = useToast();

  const toggleRole = (role: UserRole) => {
    setSelectedRoles((prev) =>
      prev.includes(role)
        ? prev.filter((r) => r !== role)
        : [...prev, role]
    )
  }

  const handleContinue = async () => {
    if (!telegramUser?.id || selectedRoles.length === 0) {
      return;
    }

    try {
      const result = await registerUserMutation.mutateAsync({
        user_id: telegramUser.id,
        username: telegramUser.username,
        first_name: telegramUser.first_name || '',
        last_name: telegramUser.last_name,
        roles: selectedRoles,
      })

      if (result.registered !== true) {
        showToast({ message: 'Registration failed', type: 'error' });
        return;
      }
      
      // Store Telegram user ID after successful registration
      if (telegramUser.id) {
        setStoredTelegramUserId(telegramUser.id)
      }
      
      queryClient.setQueryData(TANSTACK_KEYS.USER_ME(telegramUser.id), result);
      navigate(ROUTES_NAME.MARKETPLACE_HOME, { replace: true });
    } catch (error) {
      showToast({message: error instanceof Error ? error?.message : 'Failed to register user', type: 'error' });
      console.error('Failed to register user:', error)
    }
  }

  return (
    <Page>
      <PageLayout>
        <BlockNew gap={24} className={styles.container}>
          <BlockNew padding="0 16px" gap={8}>
            <Text type="hero" weight="bold" align="center">
              Welcome to Ad Marketplace
            </Text>
            <Text type="text" color="secondary" align="center">
              Choose your role to get started
            </Text>
          </BlockNew>

          <BlockNew gap={12} padding="0 16px">
            <button
              className={`${styles.roleButton} ${selectedRoles.includes('channel_owner') ? styles.roleButtonActive : ''}`}
              onClick={() => toggleRole('channel_owner')}
            >
              <Text type="title2" weight="bold">
                📺 I'm a Channel Owner
              </Text>
              <Text type="caption" color="secondary">
                List your channels and earn from ads
              </Text>
            </button>

            <button
              className={`${styles.roleButton} ${selectedRoles.includes('advertiser') ? styles.roleButtonActive : ''}`}
              onClick={() => toggleRole('advertiser')}
            >
              <Text type="title2" weight="bold">
                📢 I'm an Advertiser
              </Text>
              <Text type="caption" color="secondary">
                Promote your products and services
              </Text>
            </button>
          </BlockNew>

          <BlockNew padding="0 16px">
            <Text type="caption" color="secondary" align="center">
              You can select both roles if you want to both own channels and advertise
            </Text>
          </BlockNew>
        </BlockNew>

        <TelegramMainButton
          text={selectedRoles.length === 0 ? 'Select at least one role' : 'Continue'}
          onClick={handleContinue}
          disabled={selectedRoles.length === 0 || registerUserMutation.isPending}
          loading={registerUserMutation.isPending}
          isVisible={true}
        />
      </PageLayout>
    </Page>
  )
}
