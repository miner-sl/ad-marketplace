import { useEffect, useState } from 'react'
import Confetti from 'react-confetti'

import {useWindowSize} from "../../hooks/useWindowSize";
import {hapticFeedback} from "@utils";

interface ConfettiAnimationProps {
  active: boolean
  duration?: number
  height?: number
  width?: number
}

const DURATION = 2500;

export const ConfettiAnimation = (props: ConfettiAnimationProps) => {
  const { width: windowWith, height: windowHeight } = useWindowSize()

  const {
    active,
    duration = DURATION,
    width = windowWith,
    height = windowHeight,
  } = props

  const [isConfettiRecycled, setIsConfettiRecycled] = useState(true)

  useEffect(() => {
    if (active) {
      hapticFeedback('soft');

      const timer = setTimeout(() => {
        setIsConfettiRecycled(false)
      }, duration)

      return () => clearTimeout(timer)
    }
  }, [active])

  if (!width || !height) return null

  return (
    <Confetti
      width={width}
      height={height}
      numberOfPieces={300}
      recycle={isConfettiRecycled}
      style={{ zIndex: 1000000 }}
    />
  )
}
