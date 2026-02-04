import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  BlockNew,
  PageLayout,
  Page,
  Text,
  Spinner,
  useToast,
} from '@components';
import { useAuth } from '@context';
import config from '@config';
import type { TelegramWidgetUser } from '@types';

import styles from './LoginPage.module.scss';

const BOT_USERNAME: string = config.botName;

const isLocalhost =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1')

export function LoginPage() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [widgetLoading, setWidgetLoading] = useState(true)
  const { loginWithTelegramWidget, isTelegramMiniApp, user, loading: authLoading } = useAuth()
  const telegramWidgetRef = useRef<HTMLDivElement>(null)

  // Redirect if already authenticated
  useEffect(() => {
    if (user && !authLoading) {
      navigate('/')
    }
  }, [user, authLoading, navigate])

  const handleTelegramAuth = useCallback(
    async (user: TelegramWidgetUser) => {
      setLoading(true)
      setError('')

      try {
        await loginWithTelegramWidget(user)
        navigate('/')
      } catch (err) {
        const errorMessage =
          err instanceof Error && err.message !== ''
            ? err.message
            : 'Login failed. Please try again.'
        setError(errorMessage)
        showToast({ type: 'error', message: errorMessage })
      } finally {
        setLoading(false)
      }
    },
    [loginWithTelegramWidget, navigate, showToast]
  )

  useEffect(() => {
    // Only show widget if not in Telegram Mini App and bot username is configured
    if (isTelegramMiniApp || BOT_USERNAME === '' || telegramWidgetRef.current === null) {
      setWidgetLoading(false)
      return
    }

    // Add the Telegram callback to window
    ;(window as Window & {
      onTelegramAuth?: (user: TelegramWidgetUser) => Promise<void>
    }).onTelegramAuth = handleTelegramAuth

    // Create Telegram Login Widget script
    const script = document.createElement('script')
    script.src = 'https://telegram.org/js/telegram-widget.js?22'
    script.setAttribute('data-telegram-login', BOT_USERNAME)
    script.setAttribute('data-size', 'large')
    script.setAttribute('data-radius', '8')
    script.setAttribute('data-onauth', 'onTelegramAuth(user)')
    script.setAttribute('data-request-access', 'write')
    script.async = true

    script.onload = () => {
      // Widget script loaded, give it a moment to render
      setTimeout(() => setWidgetLoading(false), 500)
    }
    script.onerror = () => {
      setWidgetLoading(false)
      const errorMsg = 'Failed to load Telegram widget'
      setError(errorMsg)
      showToast({ type: 'error', message: errorMsg })
    }

    telegramWidgetRef.current.appendChild(script)

    return () => {
      delete (window as Window & { onTelegramAuth?: unknown }).onTelegramAuth
    }
  }, [isTelegramMiniApp, handleTelegramAuth, showToast])

  if (isTelegramMiniApp) {
    return (
      <Page guard={false}>
        <PageLayout center>
          <BlockNew gap={24} className={styles.container} align='center'>
            <BlockNew gap={8}>
              <Text type="hero" weight="bold" align="center">
                Ads Marketplace
              </Text>
              <Text type="text" color="secondary" align="center">
                Authenticating...
              </Text>
            </BlockNew>
            <Spinner size={32} />
          </BlockNew>
        </PageLayout>
      </Page>
    )
  }

  return (
    <Page guard={false}>
      <PageLayout center>
        <BlockNew gap={24} className={styles.container}>
          <BlockNew gap={8}>
            <Text type="hero" weight="bold" align="center">
              Ads Marketplace
            </Text>
            <Text type="text" color="secondary" align="center">
              Connect your Telegram account to get started
            </Text>
          </BlockNew>

          {/* Telegram Login Widget */}
          {BOT_USERNAME === '' ? (
            <BlockNew gap={8} className={styles.errorBox}>
              <Text type="text" color="danger" align="center">
                Bot username not configured
              </Text>
              <Text type="caption" color="secondary" align="center">
                Please set BOT_USERNAME in environment variables
              </Text>
            </BlockNew>
          ) : isLocalhost ? (
            <BlockNew gap={8} className={styles.warningBox}>
              <Text type="text" color="accent" align="center">
                Localhost detected
              </Text>
              <Text type="caption" color="secondary" align="center">
                Please use Telegram Mini App for authentication
              </Text>
            </BlockNew>
          ) : (
            <BlockNew gap={16}>
              {widgetLoading && (
                <BlockNew gap={8}>
                  <Spinner size={24} />
                  <Text type="caption" color="secondary" align="center">
                    Loading widget...
                  </Text>
                </BlockNew>
              )}
              <div
                ref={telegramWidgetRef}
                className={styles.widgetContainer}
              />
              {loading && (
                <BlockNew gap={8}>
                  <Spinner size={24} />
                  <Text type="caption" color="secondary" align="center">
                    Logging in...
                  </Text>
                </BlockNew>
              )}
              {error !== '' && (
                <BlockNew gap={8} className={styles.errorBox}>
                  <Text type="text" color="danger" align="center">
                    {error}
                  </Text>
                </BlockNew>
              )}
            </BlockNew>
          )}

          <Text type="caption" color="secondary" align="center">
            Sign in with your Telegram account to continue
          </Text>
        </BlockNew>
      </PageLayout>
    </Page>
  )
}
