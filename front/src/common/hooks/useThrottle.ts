import { useRef, useCallback } from 'react'

/**
 * Hook that throttles a function call
 * @param fn - The function to throttle
 * @param delay - Delay in milliseconds (default: 1000ms)
 * @returns The throttled function
 */
export function useThrottle<T extends (...args: any[]) => any>(
  fn: T,
  delay: number = 1000
): T {
  const lastRun = useRef<number>(0)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  return useCallback(
    ((...args: Parameters<T>) => {
      const now = Date.now()
      const timeSinceLastRun = now - lastRun.current

      if (timeSinceLastRun >= delay) {
        lastRun.current = now
        fn(...args)
      } else {
        // Clear any pending timeout
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
        }

        // Schedule the call for the remaining time
        const remainingTime = delay - timeSinceLastRun
        timeoutRef.current = setTimeout(() => {
          lastRun.current = Date.now()
          fn(...args)
        }, remainingTime)
      }
    }) as T,
    [fn, delay]
  )
}
