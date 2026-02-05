import { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useTelegramUser } from '@hooks'
import { ROUTES_NAME } from '@routes'
import { useUserMeQuery } from "@store-new"
import { Skeleton } from "@components"
import { getStoredTelegramUserId, clearStoredTelegramUserId, clearToken } from '@utils'

interface OnboardingGuardProps {
  children: React.ReactNode
}

export const OnboardingGuard = ({ children }: OnboardingGuardProps) => {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const telegramUser = useTelegramUser()
  const { data: userData, isLoading } = useUserMeQuery(telegramUser?.id)

  const isRegistered = userData?.registered ?? false

  // Check Telegram user ID match on mount
  useEffect(() => {
    if (!telegramUser?.id) {
      return
    }

    const storedTelegramUserId = getStoredTelegramUserId()

    // If stored user ID exists and doesn't match current, reset everything
    if (storedTelegramUserId !== null && storedTelegramUserId !== telegramUser.id) {
      console.warn('Telegram user ID mismatch detected in OnboardingGuard. Resetting user data.')
      clearToken()
      clearStoredTelegramUserId()
      // Clear all React Query cache
      queryClient.clear()
      // Redirect to onboarding
      // navigate(ROUTES_NAME.ONBOARDING, { replace: true })
      return
    }
  }, [telegramUser?.id, navigate, queryClient])

  useEffect(() => {
    if (isLoading || !telegramUser?.id) {
      return
    }

    if (location.pathname === ROUTES_NAME.ONBOARDING) {
      return
    }

    if (!isRegistered) {
      navigate(ROUTES_NAME.ONBOARDING, { replace: true })
    }
  }, [isLoading, isRegistered, navigate, location.pathname, telegramUser?.id])

  if (isLoading || !telegramUser?.id) {
    return <Skeleton />
  }

  if (!isRegistered && location.pathname !== ROUTES_NAME.ONBOARDING) {
    return null
  }

  return <>{children}</>
}
