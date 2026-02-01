import { useQuery } from '@tanstack/react-query'
import type { User } from '@types'
import { TANSTACK_KEYS, TANSTACK_TTL, TANSTACK_GC_TIME } from '@utils'

async function fetchUser(): Promise<User | null> {
  try {
    // This should be replaced with actual API call
    // For now, return null as placeholder
    return null
  } catch (error) {
    console.error('Failed to fetch user:', error)
    return null
  }
}

export const useUser = () => {
  const { data: user, isLoading, error } = useQuery<User | null>({
    queryKey: TANSTACK_KEYS.USER,
    queryFn: fetchUser,
    gcTime: TANSTACK_GC_TIME,
    staleTime: TANSTACK_TTL.USER || 60000,
    retry: false,
  })

  return {
    user: user || null,
    isLoading,
    error,
  }
}
