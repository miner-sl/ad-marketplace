import {type ReactNode, useCallback, useEffect, useState} from 'react'
import {retrieveLaunchParams, retrieveRawInitData} from '@tma.js/sdk-react'

import { MarketplaceService } from '@services'
import { clearToken, setToken } from '@utils'
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

  const checkAuth = useCallback(async () => {
    try {
      // Try to get current user with token
      const userData = await MarketplaceService.getMe();
      if (userData) {
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
          const response = await MarketplaceService.loginWithTelegramMiniApp(initDataRaw)
          setToken(response.accessToken)
          setUser(response.user)
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
  }, [isTelegramMiniApp])

  useEffect(() => {
    void checkAuth()
  }, [checkAuth])

  const loginWithTelegramWidget = useCallback(
    async (telegramUser: TelegramWidgetUser) => {
      try {
        const response = await MarketplaceService.loginWithTelegramWidget(telegramUser)
        setToken(response.accessToken)
        setUser(response.user)
        const displayName = response.user.first_name ?? response.user.firstName ?? response.user.username ?? 'User'
        showToast({ type: 'success', message: `Welcome, ${displayName}!` })
      } catch (error) {
        console.error('Login with Telegram widget failed:', error)
        showToast({
          type: 'error',
          message: error instanceof Error ? error.message : 'Login failed',
        })
        throw error
      }
    },
    [showToast]
  )

  const loginWithTelegramMiniApp = useCallback(
    async (initData: string) => {
      try {
        const response = await MarketplaceService.loginWithTelegramMiniApp(initData)
        setToken(response.accessToken)
        setUser(response.user)
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
