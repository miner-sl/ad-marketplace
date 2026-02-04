import {type ReactNode, useCallback, useEffect, useState} from 'react'
import {retrieveLaunchParams, retrieveRawInitData} from '@tma.js/sdk-react'

import { MarketplaceService } from '@services'
import { clearToken, setToken, setStoredTelegramUserId, getStoredTelegramUserId, clearStoredTelegramUserId } from '@utils'
import { useToast } from '@components'
import { AuthContext, type AuthContextType } from './AuthContext'
import type { TelegramWidgetUser, User } from '@types'

function checkIsTelegramMiniApp(): boolean {
  try {
    const launchParams = retrieveLaunchParams()
    return !!launchParams?.tgWebAppData
  } catch {
    return false
  }
}

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isTelegramMiniApp] = useState(() => checkIsTelegramMiniApp());
  const { showToast } = useToast();

  const checkTelegramUserIdMatch = useCallback(() => {
    if (!checkIsTelegramMiniApp()) {
      return true // Not a Telegram MiniApp, skip check
    }

    try {
      const launchParams = retrieveLaunchParams()
      const currentTelegramUserId = launchParams?.tgWebAppData?.user?.id
      const storedTelegramUserId = getStoredTelegramUserId()

      // If we have a stored user ID and it doesn't match current, reset
      if (storedTelegramUserId !== null && currentTelegramUserId && storedTelegramUserId !== currentTelegramUserId) {
        console.warn('Telegram user ID mismatch detected. Resetting user data.')
        clearToken()
        clearStoredTelegramUserId()
        setUser(null)
        return false
      }

      return true
    } catch (error) {
      console.error('Failed to check Telegram user ID:', error)
      return true // Continue on error
    }
  }, [])

  const checkAuth = useCallback(async () => {
    // First check if Telegram user ID matches stored one
    if (!checkTelegramUserIdMatch()) {
      setLoading(false)
      return
    }

    try {
      // Try to get current user with token
      const userData = await MarketplaceService.getMe();
      if (userData) {
        // Verify Telegram user ID matches
        const launchParams = retrieveLaunchParams()
        const currentTelegramUserId = launchParams?.tgWebAppData?.user?.id
        const userTelegramId = userData.telegram_id || userData.telegramId

        if (currentTelegramUserId && userTelegramId && currentTelegramUserId !== userTelegramId) {
          // User ID mismatch, reset
          console.warn('Stored user Telegram ID does not match current. Resetting.')
          clearToken()
          clearStoredTelegramUserId()
          setUser(null)
          setLoading(false)
          return
        }

        // Store the Telegram user ID
        if (currentTelegramUserId) {
          setStoredTelegramUserId(currentTelegramUserId)
        }

        setUser(userData);
        setLoading(false);
        return;
      }
    } catch {
      // Token invalid or expired, continue to auto-login
    }

    if (checkIsTelegramMiniApp()) {
      try {
        const initDataRaw = retrieveRawInitData()
        if (initDataRaw && initDataRaw !== '') {
          const launchParams = retrieveLaunchParams()
          const currentTelegramUserId = launchParams?.tgWebAppData?.user?.id

          const response = await MarketplaceService.loginWithTelegramMiniApp(initDataRaw)
          setToken(response.accessToken)
          setUser(response.user)

          // Store Telegram user ID
          if (currentTelegramUserId) {
            setStoredTelegramUserId(currentTelegramUserId)
          }
          // if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
          //   window.Telegram.WebApp.expand()
          //   window.Telegram.WebApp.ready()
          // }
        }
      } catch (error) {
        console.error('Telegram MiniApp auto-login failed:', error)
      }
    }

    setLoading(false)
  }, [isTelegramMiniApp, checkTelegramUserIdMatch])

  useEffect(() => {
    void checkAuth()
  }, [checkAuth])

  const loginWithTelegramWidget = useCallback(
    async (telegramUser: TelegramWidgetUser) => {
      try {
        const response = await MarketplaceService.loginWithTelegramWidget(telegramUser)
        setToken(response.accessToken)
        setUser(response.user)

        // Store Telegram user ID if available
        if (telegramUser.id) {
          setStoredTelegramUserId(telegramUser.id)
        }

        const displayName = response.user.first_name ?? response.user.firstName ?? response.user.username ?? 'User'
        showToast({ type: 'success', message: `Welcome, ${displayName}!` })
      } catch (error) {
        console.error('Login with Telegram widget failed:', error)
        showToast({
          type: 'error',
          message: error instanceof Error ? error.message : 'Login failed',
        })
        throw error
      } finally {
        setLoading(false);
      }
    },
    [showToast]
  )

  const loginWithTelegramMiniApp = useCallback(
    async (initData: string) => {
      try {
        const launchParams = retrieveLaunchParams()
        const currentTelegramUserId = launchParams?.tgWebAppData?.user?.id

        const response = await MarketplaceService.loginWithTelegramMiniApp(initData)
        setToken(response.accessToken)
        setUser(response.user)

        setLoading(false)
        // Store Telegram user ID
        if (currentTelegramUserId) {
          setStoredTelegramUserId(currentTelegramUserId)
        }

        const displayName = response.user.first_name ?? response.user.firstName ?? response.user.username ?? 'User'
        showToast({ type: 'success', message: `Welcome, ${displayName}!` })
      } catch (error) {
        console.error('Login with Telegram MiniApp failed:', error)
        showToast({
          type: 'error',
          message: error instanceof Error ? error.message : 'Login failed',
        })
        throw error
      }
    },
    [showToast]
  )

  const logout = useCallback(async () => {
    try {
      await MarketplaceService.logout()
    } catch (error) {
      console.error('Logout failed:', error)
    } finally {
      clearToken()
      clearStoredTelegramUserId()
      setUser(null)
    }
  }, [])

  const value: AuthContextType = {
    user,
    loading,
    isTelegramMiniApp,
    loginWithTelegramWidget,
    loginWithTelegramMiniApp,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
