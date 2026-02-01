import { useLaunchParams } from '@tma.js/sdk-react'
import type { TelegramWebAppUser } from 'src/types/telegram'

/**
 * Hook to get the current Telegram user ID from launch parameters
 * @returns The Telegram user ID, or undefined if not available
 */
export const useTelegramUser = (): TelegramWebAppUser | undefined => {
  const launchParams = useLaunchParams()
  return launchParams?.tgWebAppData?.user as TelegramWebAppUser | undefined
}
