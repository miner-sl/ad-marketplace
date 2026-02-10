type HapticNotificationType = 'success' | 'warning' | 'error'
type HapticImpactType = 'soft' | 'medium' | 'heavy' | 'light'

type HapticFeedbackType = HapticImpactType | HapticNotificationType

import { hapticFeedback as tmaHapticFeedback }  from "@tma.js/sdk-react";

export const hapticFeedback = (type: HapticFeedbackType) => {
  try {
    if (['success', 'warning', 'error'].includes(type)) {
      tmaHapticFeedback.notificationOccurred(
        type as HapticNotificationType
      )
    } else {
      tmaHapticFeedback.impactOccurred(type as HapticImpactType)
    }
  } catch (error) {
    console.error(error)
  }
}
