import { useQuery } from '@tanstack/react-query'
import type { User } from '@types'
import { TANSTACK_KEYS, TANSTACK_TTL, TANSTACK_GC_TIME } from '@utils'
import { MarketplaceService } from '@services'
import {useTelegramUser} from "@hooks";

async function fetchUser(telegramId: number | undefined): Promise<User | null> {
  try {
    if (!telegramId) {
      return null;
    }
    const { data, ok, error } = await MarketplaceService.getUser(telegramId)
    if (!ok) {
      if (error?.includes('404') || error?.includes('not found')) {
        return null
      }
      console.error('Failed to fetch user:', error)
      return null
    }
    if (!data?.user) {
      return null
    }
    return { ...data?.user, is_registered: true } as User
  } catch (error) {
    console.error('Failed to fetch user:', error)
    return null
  }
}

export const useUser = () => {
  const telegramUser = useTelegramUser()

  const { data: user, isLoading, error } = useQuery<User | null>({
    queryKey: [...TANSTACK_KEYS.USER, telegramUser?.id],
    queryFn: async () => fetchUser(telegramUser?.id),
    gcTime: TANSTACK_GC_TIME,
    staleTime: TANSTACK_TTL.USER || 60000,
    retry: false,
  })

  const isRegistered = user !== null && user !== undefined

  return {
    user: user || null,
    isLoading,
    error,
    isRegistered,
  }
}
