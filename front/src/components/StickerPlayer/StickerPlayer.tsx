import * as LottieModule from 'lottie-react'
import { useRef } from 'react'
import type { LottieRefCurrentProps } from 'lottie-react'

interface StickerPlayerProps {
  lottie: unknown
  height?: number
  width?: number
}

// Get the default export - handle both ESM and CJS exports
const Lottie = (LottieModule.default || LottieModule) as React.ComponentType<{
  lottieRef?: React.RefObject<LottieRefCurrentProps>
  loop?: boolean
  autoplay?: boolean
  animationData?: unknown
  style?: React.CSSProperties
}>

export const StickerPlayer = ({
  lottie,
  height = 112,
  width = 112,
}: StickerPlayerProps) => {
  const ref = useRef<LottieRefCurrentProps>(null)

  // Validate that lottie is a valid object
  if (!lottie || typeof lottie !== 'object') {
    return null
  }

  return (
    <Lottie
      lottieRef={ref}
      loop
      autoplay
      animationData={lottie}
      style={{ height, width }}
    />
  )
}
