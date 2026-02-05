import { useToast } from '@components'
import {hapticFeedback} from "@utils";

export function useClipboard() {
  const { showToast } = useToast()

  const fallbackCopy = (text: string): boolean => {
    try {
      const textArea = document.createElement('textarea')
      textArea.value = text.toString()
      textArea.style.position = 'fixed'
      textArea.style.left = '-999999px'
      textArea.style.top = '-999999px'
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()
      const successful = document.execCommand('copy')
      document.body.removeChild(textArea)
      return successful
    } catch {
      return false
    }
  }

  return {
    copy: (text: string, message: string) => {
      hapticFeedback('success')

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard
          .writeText(text.toString())
          .then(() => {
            showToast({ message, type: 'copy', time: 2000 })
          })
          .catch(() => {
            // Fallback to execCommand if clipboard API fails
            if (fallbackCopy(text)) {
              showToast({ message, type: 'copy', time: 2000 })
            } else {
              showToast({ type: 'error', message: 'Unable to copy' })
            }
          })
      } else {
        // Fallback to execCommand if clipboard API is not available
        if (fallbackCopy(text)) {
          showToast({ message, type: 'copy', time: 2000 })
        } else {
          showToast({ type: 'error', message: 'Unable to copy' })
        }
      }
    },
  }
}
